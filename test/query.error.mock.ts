import { Model } from 'mongoose'

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
    ctx: CtxType, query: any, callback: (err: Error, docs?: any[]) => void) => {
    callback(new Error('some error'))
}