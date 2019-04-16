import { Model, Types, Document } from "mongoose";
import { IPermission } from "./permissionSchema";
import { IRole } from "./roleSchema";
import { IUser } from "./userSchema";
import { ServeOptions, PermissionEnum, HasPermissionCallback, UserRequest } from "../definitions/model";
import { Request } from "express";

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
            this.role.aggregate([
                {
                    $match: {
                        _id: { $in: user.roles }
                    }
                },
                {
                    $unwind: '$schemas'
                },
                {
                    $match: {
                        'schemas.name': this.table
                    }
                },
                {
                    $group: {
                        _id: null,
                        maxPermission: { $max: '$schemas.permission' }
                    }
                }
            ], (err, res) => {
                if (err) return callback(err)
                if (res.length === 0) return callback(null, 0)
                callback(null, res[0].maxPermission)
            })
        } else {
            //by default permission to delete (without permissions).
            callback(null, 0)
        }
    }

    public checkUser(user: IUser): boolean {
        if (this.permission) {
            if (user && user._id) return true
            return false
        }
        return true
    }

    public getMaxPermissionByTable(req: UserRequest, callback: (err: Error, perm?: PermissionEnum) => void) {
        if (this.role) return this._getUserRoles(req.user, callback)
        callback(null, PermissionEnum.ADD)
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

    public getReadQuery(req: UserRequest, callback: (error: Error, query?: any) => void) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err)
            if (role >= PermissionEnum.READ) return callback(null, null)
            this.options.getFilterByPermissions(req, (err, query) => {
                if (err) return callback(err)
                this._getReadObjects(req.user, (err, ids) => {
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
    private _hasReadPermissionByOptions(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        this.options.getFilterByPermissions(req, (err, query) => {
            if (err) return callback(err, undefined)
            if (query) return this.model.findOne({ $and: [{ _id: doc._id }, query] }, (err, doc) => {
                if (err) return callback(err, undefined)
                if (doc) return callback(null, true)
                callback(null, false)
            })
            callback(null, this.role ? false : true)
        })
    }

    public hasReadPermission(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err, undefined)
            if (role >= PermissionEnum.READ) return callback(null, true)
            this._getMaxPermissionByDoc(req.user, doc, (err, permission) => {
                if (err) return callback(err, undefined)
                if (permission >= PermissionEnum.READ) return callback(null, true)
                this._hasReadPermissionByOptions(req, doc, callback)
            })
        })
    }

    private _hasAddPermissionByOptions(req: UserRequest, callback: HasPermissionCallback) {
        if (this.options.hasAddPermission) return this.options.hasAddPermission(req, callback)
        callback(null, this.role ? false : true)
    }

    public hasAddPermission(req: UserRequest, callback: HasPermissionCallback) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err, undefined)
            if (role >= PermissionEnum.ADD) return callback(null, true)
            this._hasAddPermissionByOptions(req, callback)
        })
    }

    private _hasUpdatePermissionByOptions(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasUpdatePermission) return this.options.hasUpdatePermission(req, doc, callback)
        callback(null, this.role ? false : true)
    }

    public hasUpdatePermission(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err, undefined)
            if (role >= PermissionEnum.UPDATE) return callback(null, true)
            this._getMaxPermissionByDoc(req.user, doc, (err, permission) => {
                if (err) return callback(err, undefined)
                if (permission >= PermissionEnum.UPDATE) return callback(null, true)
                this._hasUpdatePermissionByOptions(req, doc, callback)
            })
        })
    }

    private _hasDeletePermissionByOptions(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasDeletePermission) return this.options.hasDeletePermission(req, doc, callback)
        callback(null, this.role ? false : true)
    }

    public hasDeletePermission(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err, undefined)
            if (role >= PermissionEnum.DELETE) return callback(null, true)
            this._getMaxPermissionByDoc(req.user, doc, (err, permission) => {
                if (err) return callback(err, undefined)
                if (permission >= PermissionEnum.DELETE) return callback(null, true)
                this._hasDeletePermissionByOptions(req, doc, callback)
            })
        })
    }

    private _hasAdminPermissionByOptions(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        if (this.options.hasAdminPermission) return this.options.hasAdminPermission(req, doc, callback)
        callback(null, false)
    }

    public hasAdminPermission(req: UserRequest, doc: Document, callback: HasPermissionCallback) {
        this._getUserRoles(req.user, (err, role) => {
            if (err) return callback(err, undefined)
            if (role >= PermissionEnum.ADMIN) return callback(null, true)
            this._getMaxPermissionByDoc(req.user, doc, (err, permission) => {
                if (err) return callback(err, undefined)
                if (permission >= PermissionEnum.ADMIN) return callback(null, true)
                this._hasAdminPermissionByOptions(req, doc, callback)
            })
        })
    }
}