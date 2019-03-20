import { Model, DocumentQuery } from 'mongoose'
import { FullPathTypes, InfoModel } from '../definitions/model'
import * as utils from '../utils'
import { Cursor } from 'mongodb';
import { domainToASCII } from 'url';

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

export class Query {

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
        if (stringPaths.length === 0) return { query: { _id: null }, type: 'match' }
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

    static getDocsAnyIdsStep(model: Model<any>, ctx: CtxType, val: string, prevFilter: any, callback: (err: Error, query?: any) => void) {
        const query = Query.matchAny(ctx, val)
        if (query.type !== 'match') {
            const match = prevFilter ? [{ $match: prevFilter }] : []
            return model.aggregate([...match, ctx.convertStep, { $match: query.query }]).exec((err, docs) => {
                if (err) return callback(err)
                callback(null, docs)
            })
        }
        const match = prevFilter ? { $and: [query.query, prevFilter] } : query.query
        return model.find(match, { _id: 1 }, (err, docs) => {
            if (err) return callback(err)
            callback(null, docs)
        })
    }
    static getAnyIdsStep(model: Model<any>, ctx: CtxType, val, prevFilter: any, callback: (err: Error, query?: any) => void) {
        if (Array.isArray(val.$any)) {
            let processed = 0
            let target = val.$any.length
            let send = false
            let result = []
            if (target === 0) return callback(null, [])
            return val.$any.forEach(el => {
                Query.getDocsAnyIdsStep(model, ctx, el, prevFilter, (err, query) => {
                    if (!send) {
                        if (err) return callback(err)
                        processed++
                        result = result.concat(query)
                        if (processed === target) {
                            return callback(null, result)
                        }
                    }
                })
            })
        }
        Query.getDocsAnyIdsStep(model, ctx, val.$any, prevFilter, callback)
    }

    static getRefStepFromRefKey(refKey: string, models: { [key: string]: InfoModel }, ctx: CtxType, value,
        callback: (err: Error, query?: any) => void, parseFx = (el: string): any => el) {
        const targetInfoModel = models[ctx.fullPathTypes[refKey].to]
        const targetModel: Model<any> = targetInfoModel.model
        targetModel.find({ [targetInfoModel.label]: parseFx(value) }, { _id: 1 }, callback)
    }

    static getRefIdStep(models: { [key: string]: InfoModel }, ctx: CtxType, val,
        callback: (err: Error, query?: any) => void) {
        const refsKeys = Object.keys(val).filter(key => ctx.refFullPaths.indexOf(key) >= 0)
        let targetDocs = []
        refsKeys.forEach(refKey => {
            Query.getRefStepFromRefKey(refKey, models, ctx, val[refKey], (err, docs) => {
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
    if (match.$and.length === 0) return callback(null, model.find(prevFilter ? prevFilter : {}))
    if (prevFilter)
        return callback(null, model.find({ $and: [match, prevFilter] }))
    return callback(null, model.find(match))
}

function getRefResultFromAnyStep(models: { [key: string]: InfoModel }, ctx: CtxType, val: string | string[], callback: (err: Error, query?: any) => void) {
    if (ctx.refFullPaths.length === 0) return callback(null, [])
    let targetDocs = []
    let processed = 0
    ctx.refFullPaths.forEach(refKey => {
        Query.getRefStepFromRefKey(refKey, models, ctx, val, (err, docs) => {
            if (err) return callback(err)
            processed++
            if (docs.length > 0)
                targetDocs.push({ [refKey]: { $in: docs.map(el => el._id) } })
            if (processed === ctx.refFullPaths.length)
                return callback(null, targetDocs)
        }, utils.containsStringFx)
    })
}
function getRefFromAnyStep(models: { [key: string]: InfoModel }, ctx: CtxType, val: string | string[], callback: (err: Error, query?: any) => void) {
    if (Array.isArray(val)) {
        let processed = 0
        let target = val.length
        let send = false
        let result = []
        if (target === 0) return callback(null, [])
        return val.forEach(el => {
            getRefResultFromAnyStep(models, ctx, el, (err, query) => {
                if (!send) {
                    if (err) return callback(err)
                    processed++
                    result = result.concat(query)
                    if (processed === target) {
                        return callback(null, result)
                    }
                }
            })
        })
    }
    getRefResultFromAnyStep(models, ctx, val, callback)
}

function checkAnyOperator(models: { [key: string]: InfoModel }, model: Model<any>, ctx: CtxType, value,
    query: any[], prevFilter: any, callback: (err: Error, docs?: DocumentQuery<any, any>) => void) {
    if (Query.hasAnyOp(value)) {
        return getRefFromAnyStep(models, ctx, value.$any, (err, ids) => {
            if (err) return callback(err)
            return Query.getAnyIdsStep(model, ctx, value, prevFilter, (err, res) => {
                if (err) return callback(err)
                let anyIdStep = { _id: { $in: res.map(el => el._id) } }
                let aggr = query
                if (res.length > 0 && ids.length > 0) {
                    aggr.push({ $or: [{ $and: ids }, anyIdStep] })
                } else {
                    if (res.length > 0)
                        aggr.push(anyIdStep)
                    if (ids.length > 0)
                        aggr = aggr.concat(ids)
                }
                doQuery(model, ctx, value, aggr, prevFilter, callback)
            })
        })
    }
    doQuery(model, ctx, value, query, prevFilter, callback)
}

export default (models: { [key: string]: InfoModel }, model: Model<any>,
    ctx: CtxType, query: any, prevFilter: any, callback: (err: Error, cursor?: DocumentQuery<any, any>) => void) => {
    if (Object.keys(query).filter(key => ctx.fullPathTypes[key] === undefined && key !== '$any').length > 0)
        return callback(new Error('query has an attribute not in mongoose model.'))
    if (Query.hasAnyRef(ctx, query)) {
        return Query.getRefIdStep(models, ctx, query, (err, ids) => {
            if (err) return callback(err)
            checkAnyOperator(models, model, ctx, query, ids, prevFilter, callback)
        })
    }
    checkAnyOperator(models, model, ctx, query, [], prevFilter, callback)
}