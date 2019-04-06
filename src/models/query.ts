import { InfoModel, FullPathTypes } from "../definitions/model";
import { Model, DocumentQuery, Types } from 'mongoose'
import * as utils from '../utils'

export type CtxType = {
    fullPathTypes: FullPathTypes,
    refFullPaths: string[]
    stringFullPaths: string[]
    numberFullPaths: string[]
    booleanFullPaths: string[]
    dateFullPaths: string[]
    objectIdFullPaths: string[]
}
export class Query {
    private models: { [key: string]: InfoModel }
    private model: Model<any>
    private modelDefinition: CtxType
    private _query: { [key: string]: string | string[] }
    private isMongo4: boolean

    constructor(ctx: CtxType, query: { [key: string]: string | string[] }, models: { [key: string]: InfoModel }, model: Model<any>, mongo4: boolean) {
        this.models = models
        this.model = model
        this._query = query
        this.modelDefinition = ctx
        this.isMongo4 = mongo4
    }
    get hasAny() {
        return Object.keys(this._query).indexOf('$any') > -1
    }
    get hasRefs() {
        if (this.modelDefinition.refFullPaths.length > 0) {
            return this.hasAny || Object.keys(this._query).some(field => this.modelDefinition.refFullPaths.indexOf(field) > -1)
        }
        return false
    }
    get refPaths() {
        if (this.hasAny)
            return this.modelDefinition.refFullPaths
        return Object.keys(this._query).filter(field => this.modelDefinition.refFullPaths.indexOf(field) > -1)
    }
    get numberPaths() {
        return this.modelDefinition.numberFullPaths
    }
    get booleanPaths() {
        return this.modelDefinition.booleanFullPaths
    }
    get datePaths() {
        return this.modelDefinition.dateFullPaths
    }
    get objectIdPaths() {
        return this.modelDefinition.objectIdFullPaths
    }
    parseQueryValue(val: string | string[], fn = (el: string): any => el) {
        if (Array.isArray(val))
            return { $in: val.map(fn) }
        return fn(val)
    }
    getValuesContains(fields: string[], val: string | string[]): { [key: string]: { $regex: string, $options: string } }[] {
        if (Array.isArray(val)) {
            let res = []
            val.forEach(subVal => {
                res = res.concat(fields.map(field => {
                    return { [field]: utils.containsStringFx(subVal) }
                }))
            })
            return res
        }
        return fields.map(field => {
            return { [field]: utils.containsStringFx(val) }
        })
    }
    _anyOperatorQuery(val: string | string[]) {
        let query: any[] = this.getValuesContains(this.modelDefinition.stringFullPaths.concat(this.modelDefinition.refFullPaths), val)
        if (this.isMongo4) {
            query = query.concat(this.getValuesContains(this.numberPaths
                .concat(this.booleanPaths)
                .concat(this.datePaths)
                .concat(this.objectIdPaths), val))
        }
        if (Array.isArray(val)) {
            val.forEach(subVal => {
                query = query.concat(this.modelDefinition.booleanFullPaths.filter(path => path === subVal).map(path => ({
                    [path]: true
                })))
            })
        } else {
            query = query.concat(this.modelDefinition.booleanFullPaths.filter(path => path === val).map(path => ({
                [path]: true
            })))
        }
        if (!this.isMongo4) {
            if (Array.isArray(val)) {
                const numbers = val.filter(utils.isNumber)
                const boolean = val.filter(v => v === 'true' || v === 'false')
                if (numbers.length > 0) {
                    query = query.concat(this.modelDefinition.numberFullPaths.map(numberField => {
                        return { [numberField]: this.parseQueryValue(numbers, utils.parseNumberFx) }
                    }))
                }
                if (boolean.length > 0) {
                    query = query.concat(this.modelDefinition.booleanFullPaths.map(booleanField => {
                        return {
                            [booleanField]: this.parseQueryValue(boolean, el => JSON.parse(el))
                        }
                    }))
                }
                if (val.some(subval => subval.length === 24)) {
                    query = query.concat(this.modelDefinition.objectIdFullPaths.map(objectIdField => {
                        return {
                            [objectIdField]: this.parseQueryValue(val.filter(subval => subval.length === 24), el => Types.ObjectId(el))
                        }
                    }))
                }
            } else {
                if (utils.isNumber(val)) {
                    query = query.concat(this.modelDefinition.numberFullPaths.map(numberField => {
                        return { [numberField]: this.parseQueryValue(val, utils.parseNumberFx) }
                    }))
                }
                if (val === 'true' || val === 'false') {
                    query = query.concat(this.modelDefinition.booleanFullPaths.map(booleanField => {
                        return { [booleanField]: this.parseQueryValue(val) }
                    }))
                }
                if (val.length === 24) {
                    query = query.concat(this.modelDefinition.objectIdFullPaths.map(objectIdField => {
                        return {
                            [objectIdField]: this.parseQueryValue(val, el => Types.ObjectId(el))
                        }
                    }))
                }
            }
        }
        if (query.length > 0) return { $or: query }
        return {}
    }
    get _basicQuery() {
        const { $any, ...others } = this._query
        const query = Object.keys(others).map(field => {
            const value = others[field]
            if (this.modelDefinition.fullPathTypes[field].type === 'Number') {
                return {
                    field,
                    value: this.parseQueryValue(value, utils.parseNumberFx)
                }
            }
            if (this.modelDefinition.fullPathTypes[field].type === 'ObjectId') {
                return { field, value: this.parseQueryValue(value, utils.parseObjectId) }
            }
            return {
                field, value: this.parseQueryValue(value)
            }
        }).reduce((obj: { [key: string]: any }, next: { field: string, value: any }) => {
            obj[next.field] = next.value
            return obj
        }, {})
        if (this.hasAny && Object.keys(query).length > 0)
            return { $and: [query, this._anyOperatorQuery($any)] }
        if (this.hasAny)
            return this._anyOperatorQuery($any)
        return query
    }
    _convertStep(): any[] {
        let aggregation = []
        if (this.isMongo4 && this.hasAny) {
            if ((this.numberPaths.length + this.booleanPaths.length + this.datePaths.length + this.objectIdPaths.length) > 0) {
                aggregation = [{
                    $addFields: this.numberPaths.concat(this.booleanPaths).concat(this.datePaths).concat(this.objectIdPaths).reduce((el: any, path) => {
                        el[path] = { $convert: { input: `$${path}`, to: 'string', onError: '', onNull: '' } }
                        return el
                    }, {})
                }]
            }
        }
        return aggregation
    }
    query(callback) {
        const convertStep: any[] = this._convertStep()
        if (this.hasRefs) {
            let aggregation: any[] = this.refPaths.map(el => {
                const targetModel = this.models[this.modelDefinition.fullPathTypes[el].to]
                return {
                    $lookup: {
                        from: targetModel.model.collection.name,
                        localField: el,
                        foreignField: '_id',
                        as: el
                    }
                }
            })
            aggregation = aggregation.concat([
                {
                    $addFields: this.refPaths.reduce((el: any, path) => {
                        const targetModel = this.models[this.modelDefinition.fullPathTypes[path].to]
                        el[path] = `$${path}.${targetModel.label}`
                        return el
                    }, {})
                }
            ])
            aggregation = aggregation.concat(convertStep, [{
                $match: this._basicQuery
            }, {
                $project: {
                    _id: '$_id'
                }
            }])
            return this.model.aggregate(aggregation, (err, res) => {
                if (err) return callback(err)
                callback(null, this.model.find({ _id: { $in: res.map(e => e._id) } }))
            })
        }
        if (convertStep.length > 0) {
            return this.model.aggregate(convertStep.concat([{
                $match: this._basicQuery
            }, {
                $project: {
                    _id: '$_id'
                }
            }]), (err, res) => {
                if (err) return callback(err)
                callback(null, this.model.find({ _id: { $in: res.map(e => e._id) } }))
            })
        }
        return callback(null, this.model.find(this._basicQuery))
    }
}
export default (mongo4: boolean, models: { [key: string]: InfoModel }, model: Model<any>,
    ctx: CtxType, query: { [key: string]: string | string[] }, prevFilter: any, callback: (err: Error, cursor?: DocumentQuery<any, any>) => void) => {

    if (Object.keys(query).filter(key => key !== '$any').some(key => !ctx.fullPathTypes.hasOwnProperty(key)))
        return callback(new Error(Object.keys(query).filter(key => key !== '$any').find(key => !ctx.fullPathTypes.hasOwnProperty(key)) + ' not in schema.'))
    const q = new Query(ctx, Object.keys(query)
        .filter(key => query[key].length > 0)
        .reduce((obj: { [key: string]: string | string[] }, key) => {
            obj[key] = query[key]
            return obj
        }, {}), models, model, mongo4)
    return q.query(callback)
}