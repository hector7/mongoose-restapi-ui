import { Request } from 'express'
import { Document, Model } from 'mongoose';

type RequiredAttrsPath = {
    name: string,
    required: boolean
}

export type ObjectPath = RequiredAttrsPath & {
    complex: true,
    name: string,
    type: 'Object',
    children: Path[]
}
type ArrayPath = RequiredAttrsPath & {
    complex: true,
    type: 'Array',
    label: string,
    children: Path[]
}
type FieldPath = RequiredAttrsPath & {
    type: 'Number' | 'String' | 'Boolean' | 'ObjectId',
}
export type Path = FieldPath | ObjectPath | ArrayPath

export type HasPermissionCallback = (error: Error | null, hasPermission: boolean, reason?: string) => void

type RequestFilterQuery = (req: Request, callback: (error: Error | null, query: { [key: string]: any }) => void) => void
type EditPermision = (req: Request, doc: Document, callback: HasPermissionCallback) => void
export type ServeOptions = {
    MAX_RESULTS?: number,
    name?: string,
    getFilterByPermissions?: RequestFilterQuery,
    hasEditPermission?: EditPermision,
    hasAddPermission?: EditPermision,
    hasUpdatePermission?: EditPermision,
    hasDeletePermission?: EditPermision,
}
export type InfoModel = {
    name: string,
    label: string,
    route: string,
    paths: Path[],
    model: Model<any>
}

export type FullPathTypes = { type: string } | { type: 'Ref' | 'ArrayRef', to: string } | {}