import { Request } from 'express'
import { Document } from 'mongoose';

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

export type HasPermissionCallback = (error: Error, hasPermission: boolean, reason?: string) => void

type GetPermissionCallback = (error: Error, query: any) => void
type EditPermision = (req: Request, doc: Document, callback: HasPermissionCallback) => void
export type ServeOptions = {
    MAX_RESULTS?: number,
    name?: string,
    getPermissionStep?: (callback: GetPermissionCallback) => void,
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
    model: any
}

export type FullPathTypes = { type: string } | { type: 'Ref' | 'ArrayRef', to: string } | {}