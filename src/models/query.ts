import { Model, DocumentQuery } from 'mongoose'
import { FullPathTypes, InfoModel } from '../definitions/model'
import * as utils from '../utils'
import { Cursor } from 'mongodb';

export type CtxType = {
    convertStep: { $addFields: { [key: string]: any } }
    fullPathTypes: FullPathTypes,
    refFullPaths: string[]
    stringFullPaths: string[]
    numberFullPaths: string[]
    booleanFullPaths: string[]
    dateFullPaths: string[]
    objectIdFullPaths: string[]
    isNumber: (field: string) => boolean
    transformationMap: { [key: string]: string }
}

class Query {

    static matchAny(ctx, value) {
        const stringPaths = ctx.stringFullPaths.map(sk => ({ [sk]: Query.parseValue(value, utils.containsStringFx) }))
        let isnumber = utils.isNumber(value)
        if (isnumber) {
            const numberPaths = ctx.numberFullPaths.map(sk => ({ [ctx.transformationMap[sk]]: Query.parseValue(value, utils.containsStringFx) }))
            if (value.length < 5 && parseInt(value)) {
                const datePaths = ctx.dateFullPaths.map(sk => ({ [ctx.transformationMap[sk]]: Query.parseValue(value, utils.containsStringFx) }))
                return { query: { $or: stringPaths.concat(numberPaths).concat(datePaths) }, type: 'number' }
            }
            //const numberPaths = fullPathNumber.map(sk => (parseValue(numbers(sk), containsNumberFx, '$or')))
            return { query: { $or: stringPaths.concat(numberPaths) }, type: 'number' }
        }
        if (value === 'true' || value === 'false') {
            const booleanPaths = ctx.booleanFullPaths.map(sk => ({ [ctx.transformationMap[sk]]: Query.parseValue(value) }))
            return { query: { $or: stringPaths.concat(booleanPaths) }, type: 'boolean' }
        }
        if (value.length === 24) {
            const objectidPaths = ctx.objectIdFullPaths.map(sk => ({ [ctx.transformationMap[sk]]: Query.parseValue(value) }))
            return { query: { $or: stringPaths.concat(objectidPaths) }, type: 'objectid' }
        }
        return { query: { $or: stringPaths }, type: 'match' }
    }

    static parseValue(val, fn = el => el, key = '$in') {
        if (Array.isArray(val))
            return { [key]: val.map(fn) }
        return fn(val)
    }

    static getMatch(ctx: CtxType, query, predefined) {
        function parseValue(val, fn = el => el, key = '$in') {
            if (Array.isArray(val))
                return { [key]: val.map(fn) }
            return fn(val)
        }
        return {
            $and: Object.keys(query)
                .filter(key => key !== '$any')
                .filter(key => ctx.refFullPaths.indexOf(key) < 0)
                .map(el => {
                    const value = query[el]
                    if (ctx.fullPathTypes[el].type === 'Number') {
                        return {
                            [el]: parseValue(value, utils.parseNumberFx)
                        }
                    }
                    if (ctx.fullPathTypes[el].type === 'ObjectId') {
                        return { [el]: parseValue(value, utils.parseObjectId) }
                    }
                    return {
                        [el]: parseValue(value)
                    }
                }).concat(predefined)
        }
    }

    static hasAnyOp(val): boolean {
        return Object.keys(val).some(el => el === '$any')
    }

    static hasAnyRef(ctx: CtxType, val): boolean {
        return Object.keys(val).some(el => ctx.refFullPaths.indexOf(el) >= 0)
    }

    static mapAnyResultStep(docs) {
        return { _id: { $in: docs.map(el => el._id) } }
    }
    static getAnyIdsStep(model: Model<any>, ctx: CtxType, val, prevFilter: any, callback: (err: Error, query?: any) => void) {
        const query = Query.matchAny(ctx, val.$any)
        if (query.type !== 'match') {
            const match = prevFilter ? [{ $match: prevFilter }] : []
            return model.aggregate([...match, ctx.convertStep, { $match: query.query }]).exec((err, docs) => {
                if (err) return callback(err)
                callback(null, Query.mapAnyResultStep(docs))
            })
        }
        const match = prevFilter ? { $and: [query.query, prevFilter] } : query.query
        return model.find(match, { _id: 1 }, (err, docs) => {
            if (err) return callback(err)
            callback(null, Query.mapAnyResultStep(docs))
        })
    }

    static getRefIdStep(models: { [key: string]: InfoModel }, ctx: CtxType, val,
        callback: (err: Error, query?: any) => void) {
        const refsKeys = Object.keys(val).filter(key => ctx.refFullPaths.indexOf(key) >= 0)
        let targetDocs = []
        refsKeys.forEach(refKey => {
            const cb = (err, docs) => {
            }
            const targetInfoModel = models[ctx.fullPathTypes[refKey].to]
            const targetModel: Model<any> = targetInfoModel.model
            targetModel.find({ [targetInfoModel.label]: val[refKey] }, { _id: 1 }, (err, docs) => {
                if (err) return callback(err)
                targetDocs.push({ [refKey]: { $in: docs.map(el => el._id) } })
                if (targetDocs.length === refsKeys.length)
                    return callback(null, targetDocs)
            })
        })
    }
}

function doQuery(model: Model<any>, ctx: CtxType, value,
    query: any[], prevFilter: any, callback: (err: Error, docs?: DocumentQuery<any, any>) => void) {
    if (Object.keys(value).length === 0) {
        const query = prevFilter ? prevFilter : {}
        return callback(null, model.find(query))
    }
    const match = Query.getMatch(ctx, value, query)
    if (prevFilter)
        return callback(null, model.find({ $and: [match, prevFilter] }))
    return callback(null, model.find(match))
}

function checkAnyOperator(model: Model<any>, ctx: CtxType, value,
    query: any[], prevFilter: any, callback: (err: Error, docs?: DocumentQuery<any, any>) => void) {
    if (Query.hasAnyOp(value)) {
        return Query.getAnyIdsStep(model, ctx, value, prevFilter, (err, res) => {
            if (err) return callback(err)
            doQuery(model, ctx, value, query.concat(res), prevFilter, callback)
        })
    }
    doQuery(model, ctx, value, query, prevFilter, callback)
}

export default (models: { [key: string]: InfoModel }, model: Model<any>,
    ctx: CtxType, query: any, prevFilter: any, callback: (err: Error, cursor?: DocumentQuery<any, any>) => void) => {
    new Query()
    if (Object.keys(query).filter(key => ctx.fullPathTypes[key] === undefined && key !== '$any').length > 0)
        return callback(new Error('query has an attribute not in mongoose model.'))
    if (Query.hasAnyRef(ctx, query)) {
        return Query.getRefIdStep(models, ctx, query, (err, ids) => {
            if (err) return callback(err)
            checkAnyOperator(model, ctx, query, ids, prevFilter, callback)
        })
    }
    checkAnyOperator(model, ctx, query, [], prevFilter, callback)
}