import { Request } from 'express'
import { Document, Model } from 'mongoose';
import { IPermission } from '../models/permissionSchema';
import { SchemaRolePermission } from '../models/roleSchema';
import { IUser } from '../models/userSchema';

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

export type UserRequest = Request & {
    user: IUser
}

export type EditRequest<T extends Document> = UserRequest & {
    doc: T
}
export type EditPermRequest<T extends Document> = EditRequest<T> & {
    doc_perm: IPermission
}

export type PermissionRequest<T extends Document> = EditRequest<T> & {
    perm: IPermission,
    permission: PermissionEnum,
    role: PermissionEnum
}

type RequestFilterQuery = (req: UserRequest, callback: (error: Error | null, query: { [key: string]: any }) => void) => void
type EditPermision = (req: UserRequest, doc: Document, callback: HasPermissionCallback) => void
type AddPermision = (req: UserRequest, callback: HasPermissionCallback) => void
type GlobalPermision = (req: UserRequest, callback: (error: Error | null, permission: PermissionEnum) => void) => void
type GetMaxPermission = { getMaxPermission: GlobalPermision }
type PermissionCallbacks = {
    getFilterByPermissions?: RequestFilterQuery,
    hasAdminPermission: EditPermision,
    hasEditPermission: EditPermision,
    hasAddPermission: AddPermision,
    hasUpdatePermission: EditPermision,
    hasDeletePermission: EditPermision,
}
export type PermissionChecks = PermissionCallbacks & GetMaxPermission
export type ServeOptions = {
    MAX_RESULTS?: number,
    name?: string
} & Partial<PermissionCallbacks>

export type HasPermissionCallback = (error: Error | null, hasPermission: boolean, reason?: string) => void


export type InfoModel = {
    name: string,
    label: string,
    route: string,
    paths: Path[],
    model: Model<any>
}

export enum PermissionEnum {
    ADMIN = 5,
    DELETE = 4,
    UPDATE = 3,
    READ = 2,
    ADD = 1,
}

const PERMISSION_MODEL = 'Permission'
const ROLE_MODEL = 'Role'
export { PERMISSION_MODEL, ROLE_MODEL }

export type FullPathTypes = { type: string } | { type: 'Ref' | 'ArrayRef', to: string } | {}