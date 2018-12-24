import { Model } from 'mongoose'
import { FullPathTypes, InfoModel } from '../src/definitions/model'
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


export default (models: { [key: string]: InfoModel }, model: Model<any>,
    ctx: CtxType, query: any, prevQuery: any, callback: (err: Error, query?: any) => void) => {
    const count = callback => callback(new Error('some error'))
    callback(null, { count })
}