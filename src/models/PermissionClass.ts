import { Model, Types, Document } from "mongoose";
import { IPermission } from "./permissionSchema";
import { IRole } from "./roleSchema";
import { IUser } from "./userSchema";
import { ServeOptions, PermissionEnum, HasPermissionCallback } from "../definitions/model";

export default class PermissionClass {
    private table: string
    private permission: Model<IPermission>
    private role: Model<IRole>
    private options: ServeOptions
    private model: Model<Document>

    constructor(model: Model<Document>, permission: Model<IPermission>, role: Model<IRole>, options: ServeOptions) {
        this.table = model.modelName
        this.model = model
        this.permission = permission
        this.role = role
        this.options = options
    }

    private _getReadObjects(user: IUser, callback: (err: Error, res?: Types.ObjectId[]) => void) {
        const { table, permission } = this
        if (!permission) return callback(null)
        permission.find({ table, user: user._id }, { object: 1 }, (err, res) => {
            if (err) return callback(err)
            callback(null, res.map(el => el.object))
        })
    }

    private _getUserRoles(user: IUser, callback: (err: Error, role?: PermissionEnum) => void) {
        if (this.role) {
            if (!user.roles) return callback(null, 0)
            if (user.roles.length === 0) return callback(null, 0)
            this.role.find({ 'schemas.name': this.table, _id: { $in: user.roles } }, (err, roles) => {
                if (err) return callback(err)
                let perm = 0
                roles.forEach(role => {
                    const maxPerm = role.schemas.filter(s => s.name === this.table).reduce((curr, next) => {
                        return Math.max(curr, next.permission)
                    }, 0)
                    if (perm < maxPerm)
                        perm = maxPerm
                })
                callback(null, perm)
            })
        } else {
            //by default permission to delete (without permissions).
            callback(null, 0)
        }
    }

    private _getMaxPermissionByDoc(user: IUser, doc: Document, callback: (err: Error, perm?: PermissionEnum) => void) {
        if (this.permission) {
            return this.permission.findOne({ table: this.model.modelName, user: user._id, object: doc._id }, (err, permObj) => {
                if (err) return callback(err)
                let permission = 0
                if (permObj) {
                    permission = permObj.permission
                }
                callback(null, permission)
            })
        } else {
            callback(null, 0)
        }
    }

    public getReadQuery(user: IUser, callback: (error: Error, query?: any) => void) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.READ) return callback(null, null)
            this.options.getQuery(user, (err, query) => {
                if (err) return callback(err)
                this._getReadObjects(user, (err, ids) => {
                    if (err) return callback(err)
                    if (ids) {
                        if (ids.length === 0 && !query) return callback(null, { _id: { $exists: false } })
                        if (ids.length === 0) return callback(null, query)
                        if (query) return callback(null, { $and: [query, { _id: { $in: ids } }] })
                        return callback(null, { _id: { $in: ids } })
                    }
                    return callback(null, query)
                })
            })
        })
    }
    private _hasReadPermissionByOptions(user: IUser, doc: Document, callback: HasPermissionCallback) {
        this.options.getQuery(user, (err, query) => {
            if (err) return callback(err)
            if (query) return this.model.findOne({ $and: [{ _id: doc._id }, query] }, (err, doc) => {
                if (err) return callback(err)
                if (doc) return callback(null, true)
                callback(null, false)
            })
            callback(null, this.role ? false : true)
        })
    }

    public hasReadPermission(user: IUser, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.READ) return callback(null, true)
            this._getMaxPermissionByDoc(user, doc, (err, permission) => {
                if (err) return callback(err)
                if (permission >= PermissionEnum.READ) return callback(null, true)
                this._hasReadPermissionByOptions(user, doc, callback)
            })
        })
    }

    private _hasAddPermissionByOptions(user: IUser, callback: HasPermissionCallback) {
        if (this.options.hasAddPermission) return this.options.hasAddPermission(user, callback)
        callback(null, this.role ? false : true)
    }

    public hasAddPermission(user: IUser, callback: HasPermissionCallback) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.ADD) return callback(null, true)
            this._hasAddPermissionByOptions(user, callback)
        })
    }

    private _hasUpdatePermissionByOptions(user: IUser, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasUpdatePermission) return this.options.hasUpdatePermission(user, doc, callback)
        callback(null, this.role ? false : true)
    }

    public hasUpdatePermission(user: IUser, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.UPDATE) return callback(null, true)
            this._getMaxPermissionByDoc(user, doc, (err, permission) => {
                if (err) return callback(err)
                if (permission >= PermissionEnum.UPDATE) return callback(null, true)
                this._hasUpdatePermissionByOptions(user, doc, callback)
            })
        })
    }

    private _hasDeletePermissionByOptions(user: IUser, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasDeletePermission) return this.options.hasDeletePermission(user, doc, callback)
        callback(null, this.role ? false : true)
    }

    public hasDeletePermission(user: IUser, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.DELETE) return callback(null, true)
            this._getMaxPermissionByDoc(user, doc, (err, permission) => {
                if (err) return callback(err)
                if (permission >= PermissionEnum.DELETE) return callback(null, true)
                this._hasDeletePermissionByOptions(user, doc, callback)
            })
        })
    }

    private _hasAdminPermissionByOptions(user: IUser, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasAdminPermission) return this.options.hasAdminPermission(user, doc, callback)
        callback(null, false)
    }

    public hasAdminPermission(user: IUser, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.ADMIN) return callback(null, true)
            this._getMaxPermissionByDoc(user, doc, (err, permission) => {
                if (err) return callback(err)
                if (permission >= PermissionEnum.ADMIN) return callback(null, true)
                this._hasAdminPermissionByOptions(user, doc, callback)
            })
        })
    }
}