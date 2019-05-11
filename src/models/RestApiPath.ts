import { Model, SchemaType, Document, DocumentQuery, Types } from 'mongoose';
import { Router, Request, Response } from 'express'
import { EventEmitter } from 'events';
import { HasPermissionCallback, ServeOptions, FullPathTypes, Path, InfoModel, ObjectPath, PermissionRequest, EditRequest, UserRequest, PermissionEnum, EditPermRequest, RolePermRequest } from '../definitions/model'
import * as utils from '../utils'
import getQuery from './query'
import { IPermission } from './permissionSchema';
import { callbackify } from 'util';
import { IRole } from './roleSchema';
import { IUser } from './userSchema';
import PermissionClass from './PermissionClass';


const defaultOptions = {
    MAX_RESULTS: 100,
    name: 'name',
    getFilterByPermissions: (req: Request, callback) => {
        callback(null, null)
    }
}

type CustomSchemaType = SchemaType & { instance: string }

type UserPermission = {
    role: PermissionEnum,
    permission: PermissionEnum
}

const routerWeakMap = new WeakMap()

function getOptions(options: ServeOptions) {
    if (options) {
        const { hasEditPermission, hasAddPermission, hasUpdatePermission, hasDeletePermission } = options
        if (hasEditPermission) {
            const add = hasAddPermission
            const updatePermission = hasUpdatePermission ? hasUpdatePermission : hasEditPermission
            const deletePermission = hasDeletePermission ? hasDeletePermission : hasEditPermission
            return { ...defaultOptions, ...options, hasAddPermission: add, hasUpdatePermission: updatePermission, hasDeletePermission: deletePermission }
        }
        return { ...defaultOptions, ...options }
    }
    return defaultOptions
}

export default class RestApiPath<T extends Document> {

    private _route: string
    private _model: Model<T>
    private _options: ServeOptions
    private _emitter: EventEmitter
    private _paths: Path[]
    private _stringFullPaths: string[]
    private _numberFullPaths: string[]
    private _booleanFullPaths: string[]
    private _dateFullPaths: string[]
    private _objectIdFullPaths: string[]
    private _refFullPaths: string[]
    private _arrayFullPaths: string[]
    private _fullPathTypes: FullPathTypes
    private isMongo4: boolean
    constructor(router: Router, route: string, model: Model<T>, options: ServeOptions, mongo4 = true) {
        routerWeakMap.set(this, router)
        this._options = getOptions(options)
        this._route = route
        this._model = model
        this._emitter = new EventEmitter()
        this._paths = this._getModelProperties(model.schema)
        this.isMongo4 = mongo4
        this._generateFullPathTypes()
    }

    get MAX_RESULTS(): number {
        return this.options.MAX_RESULTS
    }

    get emitter(): EventEmitter {
        return this._emitter
    }

    get model(): Model<T> {
        return this._model
    }

    get route(): string {
        return this._route
    }

    get router(): Router {
        return routerWeakMap.get(this)
    }

    get options(): ServeOptions {
        return this._options
    }

    get paths(): Path[] {
        return this._paths
    }

    get infoModel(): InfoModel {
        return { name: this.model.modelName, route: this.route, label: this.options.name, paths: this.paths, model: this.model }
    }

    get arrayFullPaths() {
        return this._arrayFullPaths
    }

    get refFullPaths() {
        return this._refFullPaths
    }

    get fullPathTypes(): FullPathTypes {
        return this._fullPathTypes
    }

    get numberFullPaths() {
        return this._numberFullPaths
    }

    get stringFullPaths() {
        return this._stringFullPaths
    }

    get booleanFullPaths() {
        return this._booleanFullPaths
    }

    get dateFullPaths() {
        return this._dateFullPaths
    }

    get objectIdFullPaths() {
        return this._objectIdFullPaths
    }

    private _generateFullPathTypes() {
        const fullPathTypes = this._getFullPathTypes()
        this._fullPathTypes = fullPathTypes
        this._stringFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'String' || fullPathTypes[fullPath].type === 'ArrayString')
        this._booleanFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'Boolean' || fullPathTypes[fullPath].type === 'ArrayBoolean')
        this._dateFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'Date' || fullPathTypes[fullPath].type === 'ArrayDate')
        this._objectIdFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'ObjectId' || fullPathTypes[fullPath].type === 'ArrayObjectId')
        this._arrayFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type.startsWith('Array'))
        this._numberFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'Number' || fullPathTypes[fullPath].type === 'ArrayNumber')
        this._refFullPaths = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath].type === 'Ref' || fullPathTypes[fullPath].type === 'ArrayRef')
    }

    private _getType = (type: string): string => {
        return type.replace('Schema', '')
    }

    private _transformPaths(paths): [Path] {
        let pathsWithObject = paths.filter(el => el.name.indexOf('.') >= 0)
        let pathsWithoutObject = paths.filter(el => el.name.indexOf('.') < 0)
        let newObjects = []
        const visited = []
        pathsWithObject.forEach((el, key) => {
            if (visited.indexOf(el) < 0) {
                const base = el.name.split('.').shift()
                let newObject = {
                    name: base,
                    complex: true,
                    type: 'Object',
                    children: [{
                        ...el,
                        name: el.name.split('.').slice(1).join('.'),
                    }].concat(this._transformPaths(pathsWithObject.slice(key + 1).filter(el => el.name.startsWith(base + '.')).map(el => ({
                        ...el,
                        name: el.name.slice(base.length + 1),
                    }))))
                }
                pathsWithObject.slice(1).filter(el => el.name.startsWith(base + '.')).forEach(el => {
                    visited.push(el)
                })
                const labeledChild = newObject.children.find(child => child.label)
                if (!labeledChild) this._warnLabel(newObject.name, { name: newObject.children[0].name, type: newObject.children[0].type })
                newObjects.push({
                    ...newObject,
                    label: labeledChild ? labeledChild.name : undefined,
                    children: newObject.children.map(child => {
                        const { label, ...others } = child
                        return others
                    })
                })
            }
        })
        return pathsWithoutObject.concat(newObjects)
    }

    private _warnLabel(pathName: string, child: { name: string, type: string }) {
        console.warn(`WARNING: ${this.infoModel.name}: One children of path "${pathName}" must have a flag with "label: true" for UI purpose.
                    Suggestion: ${child.name}: {type: ${child.type}, label: true}\n\n`)
    }
    private _getModelProperties(schema): Path[] {
        return this._transformPaths(Object.keys(schema.paths).map((key) => {
            const type = schema.paths[key].constructor.name
            if (type === 'SchemaType') {
                const children = schema.paths[key].schema
                const labels = Object.keys(children.paths).filter(el => children.paths[el].options.label)
                const path = {
                    name: key,
                    type: 'Object',
                    label: labels.length > 0 ? labels.shift() : undefined,
                    required: schema.requiredPaths(true).indexOf(key) >= 0,
                    children: this._getModelProperties(schema.paths[key].schema)
                }
                if (labels.length === 0) this._warnLabel(key, { name: path.children[0].name, type: path.children[0].type })
                return path
            }
            if (type === 'DocumentArray') {
                const children = schema.paths[key].schema
                const labels = Object.keys(children.paths).filter(el => children.paths[el].options.label)
                const path = {
                    name: key,
                    type: 'Array',
                    complex: true,
                    label: labels.length > 0 ? labels.shift() : undefined,
                    required: schema.requiredPaths(true).indexOf(key) >= 0,
                    children: this._getModelProperties(schema.paths[key].schema)
                }
                if (labels.length === 0) this._warnLabel(key, { name: path.children[0].name, type: path.children[0].type })
                return path
            }
            if (type === 'ObjectId' && schema.paths[key].options.ref !== undefined) {
                return {
                    name: key,
                    type: 'Ref',
                    label: schema.paths[key].options.label,
                    to: schema.paths[key].options.ref
                }
            }

            if (schema.paths[key].caster) {
                if (schema.paths[key].caster.options.ref) {
                    return {
                        name: key,
                        type: 'ArrayRef',
                        label: schema.paths[key].options.label,
                        required: schema.requiredPaths(true).indexOf(key) >= 0,
                        to: schema.paths[key].caster.options.ref
                    }
                }
                return {
                    name: key,
                    label: schema.paths[key].options.label,
                    auto: schema.paths[key].options.auto,
                    type: 'Array' + schema.paths[key].caster.instance,
                    required: schema.requiredPaths(true).indexOf(key) >= 0
                }
            }
            return {
                name: key,
                label: schema.paths[key].options.label,
                auto: schema.paths[key].options.auto,
                type: this._getType(schema.paths[key].constructor.name),
                required: schema.requiredPaths(true).indexOf(key) >= 0
            };
        }));
    }

    private _getFullPathTypes(): FullPathTypes {
        function getFullPath(paths: Path[]): FullPathTypes {
            const fullPaths = {}
            paths.forEach((path: Path) => {
                if (path.type === 'Array' || (<ObjectPath>path).complex) {
                    const children = getFullPath((<ObjectPath>path).children)
                    Object.keys(children).forEach(el => {
                        fullPaths[`${path.name}.${el}`] = children[el]
                    })
                } else {
                    fullPaths[path.name] = path
                }
            })
            return fullPaths
        }
        return getFullPath(this.paths)
    }

    public getItem(id: string, callback: (err: any, res?: any) => void) {
        this.model.findById(id, (err, res) => {
            if (err || !res) {
                return this.model.findOne({ [this.options.name]: id }, callback)
            }
            return callback(err, res)
        })
    }

    /*
    private getEditObjects(Permission: Model<IPermission>, req: UserRequest, callback: (err: Error, res?: Types.ObjectId[]) => void) {
        const table = this.model.modelName
        Permission.find({ table, user: req.user._id }, { _id: 1 }, (err, res) => {
            if (err) return callback(err)
            callback(null, res.map(el => el.object))
        })
    }

    private getAdminObjects(Permission: Model<IPermission>, req: UserRequest, callback: (err: Error, res?: Types.ObjectId[]) => void) {
        const table = this.model.modelName
        Permission.find({ table, user: req.user._id }, { _id: 1 }, (err, res) => {
            if (err) return callback(err)
            callback(null, res.map(el => el.object))
        })
    }
    */

    private _addPermission(req: UserRequest, Permission: Model<IPermission>, object: Types.ObjectId, callback: (err: Error) => void) {
        const table = this.model.modelName
        if (!Permission) {
            return callback(null)
        }
        let p = new Permission({ table, object, user: req.user._id, permission: PermissionEnum.DELETE })
        p.save(callback)
    }

    private _deletePermission(Permission: Model<IPermission>, object: Types.ObjectId, callback: (err: Error) => void) {
        const table = this.model.modelName
        if (Permission) return Permission.deleteMany({ table, object }, callback)
        callback(null)
    }

    public static setRoleEndpoints(router: Router, route: string, Role: Model<IRole>) {
        router.use(`${route === '' ? '/' : route}`, (req, res, next) => {
            if (req.method === 'GET' || req.method === 'DELETE') return next()
            if (req.body) return next()
            let data = ''
            req.on('data', (chunk) => {
                data += chunk.toString()
            })
            req.on('end', () => {
                try {
                    req.body = JSON.parse(data)
                    next()
                } catch (err) {
                    res.status(400).send('Body is not a valid json.')
                }
            })
        })
        router.use(`${route === '' ? '/' : route}`, (req: UserRequest, res: Response, next) => {
            if (req.user.super_admin) return next()
            res.status(403).send()
        })

        router.get(`${route === '' ? '/' : route}`, (req: UserRequest, res: Response) => {
            Role.find({}, (err, docs) => {
                if (err) return res.status(500).send(err.message)
                res.send(docs)
            })
        })

        router.post(`${route === '' ? '/' : route}`, (req: RolePermRequest, res: Response) => {
            const permission = new Role(req.body)
            permission.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(201).send(permission)
            })
        })

        router.use(`${route.endsWith('/') ? route.slice(0, -1) : route}/:role`, (req: RolePermRequest, res: Response, next) => {
            Role.findById(req.params.role, (err, doc) => {
                if (err) return Role.findOne({ name: req.params.role }, (err, doc) => {
                    if (err) return res.status(500).send(err.message)
                    if (!doc) return res.status(404).send('Not found')
                    req.role = doc
                    next()
                })
                req.role = doc
                next()
            })
        })
        router.get(`${route.endsWith('/') ? route.slice(0, -1) : route}/:role`, (req: RolePermRequest, res: Response) => {
            res.send(req.role)
        })

        router.put(`${route.endsWith('/') ? route.slice(0, -1) : route}/:role`, (req: RolePermRequest, res: Response) => {
            req.role.name = req.body.name
            req.role.schemas = req.body.schemas
            req.role.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(200).send(req.body)
            })
        })

        router.patch(`${route.endsWith('/') ? route.slice(0, -1) : route}/:role`, (req: RolePermRequest, res: Response) => {
            if (req.body.name) req.role.name = req.body.name
            if (req.body.schemas) req.role.schemas = req.body.schemas
            req.role.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(200).send(req.role)
            })
        })

        router.delete(`${route.endsWith('/') ? route.slice(0, -1) : route}/:role`, (req: RolePermRequest, res: Response) => {
            req.role.remove((err) => {
                if (err) return res.status(500).send(err.message)
                res.send(req.role)
            })
        })
        return router
    }

    public setEndPoints(models, Permission: Model<IPermission>, Role: Model<IRole>) {
        const permission = new PermissionClass(this.model, Permission, Role, this.options)
        const table = this.model.modelName
        this.router.use(this.route, (req, res, next) => {
            if (req.method === 'GET' || req.method === 'DELETE') return next()
            if (req.body) return next()
            let data = ''
            req.on('data', (chunk) => {
                data += chunk.toString()
            })
            req.on('end', () => {
                try {
                    req.body = JSON.parse(data)
                    next()
                } catch (err) {
                    res.status(400).send('Body is not a valid json.')
                }
            })
        })

        this.router.use(this.route, (req: UserRequest, res, next) => {
            if (!permission.checkUser(req.user)) return res.status(500).send(`<h1>Request needs mongodb user</h1>
            <p>Fix it adding a middleware, useful for your project.</p>
            <p>Example:</p>
            <p><code>app.use("/", (req, res, next)=>{<br/>
            &emsp;User.findOne({username: req.user}, (err, user)=>{<br/>
            &emsp;&emsp;if(err) return next(err)<br/>
            &emsp;&emsp;req.user = user<br/>
            &emsp;&emsp;next()<br/>
            &emsp;})<br/>
            }</code>)</p>`)
            next()
        })

        this.router.use(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response, next) => {
            this.getItem(req.params.id, (err, item) => {
                if (err) return res.status(500).send(err.message);
                if (!item) return res.sendStatus(404);
                req.doc = item
                next()
            })
        })


        this.router.get(`${this.route}`, (req: UserRequest, res: Response) => {
            permission.getReadQuery(req, (err, query) => {
                if (err) return res.status(500).send(err.message)
                const { $page, $rowsPerPage, $sort, $sortBy, ...others } = req.query
                if (Object.keys(others).filter(key => !this.fullPathTypes.hasOwnProperty(key) && key !== '$any').length > 0) {
                    return res.status(400).send('Path ' + Object.keys(others).find(key => !this.fullPathTypes.hasOwnProperty(key)) + ' not in schema')
                }
                getQuery(this.isMongo4, models, this.model, this, others, query, (err, cursor: DocumentQuery<T, T>) => {
                    if (err) return res.status(500).send(err.message)
                    cursor.count((err, count) => {
                        if (err) return res.status(500).send(err.message)
                        const page = $page ? $page : 1
                        const rowsPerPage = $rowsPerPage ? parseInt($rowsPerPage) : this.MAX_RESULTS
                        let sort = null
                        if ($sortBy) {
                            if (Array.isArray($sortBy)) {
                                sort = $sortBy.map((field, key) => ({
                                    field,
                                    direction: $sort && Array.isArray($sort) ? $sort[key] ? $sort[key] : 1 : $sort ? $sort : 1
                                })).reduce((el: any, next) => {
                                    el[next.field] = next.direction
                                    return el
                                }, {})
                            } else {
                                sort = { [$sortBy]: $sort ? Array.isArray($sort) ? $sort.pop() : $sort : 1 }
                            }
                            cursor = cursor.sort(sort)
                        }
                        cursor
                            .skip((parseInt(page) - 1) * rowsPerPage)
                            .limit(rowsPerPage)
                            .find((err, results) => {
                                if (err) return res.status(500).send(err.message)
                                return res.send({
                                    total_pages: Math.ceil(count / rowsPerPage),
                                    page,
                                    count,
                                    sort,
                                    results,
                                })
                            })
                    })
                })
            })
        });
        this.router.get(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response) => {
            permission.hasReadPermission(req, req.doc, (err: Error | null, hasPermission: boolean, reason?: string) => {
                if (err) res.status(500).send(err.message)
                if (!hasPermission) return res.status(403).send()
                res.send(req.doc);
            })
        });
        this.router.post(`${this.route}`, (req: PermissionRequest<T>, res: Response) => {
            let item = new this.model(req.body)
            utils.replaceObjectIds(this.paths, item)
            permission.hasAddPermission(req, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    item.save((err, result) => {
                        if (err) return res.status(500).send(err.message);
                        this._addPermission(req, Permission, result._id, (err) => {
                            if (err) return res.status(500).send('Error setting owner permission: ' + err.message)
                            res.status(201).send(result);
                            this.emitter.emit('add', result)
                        })
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });
        this.router.put(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response) => {
            const oldItem = req.doc.toObject()
            permission.hasUpdatePermission(req, req.doc, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    this.model.schema.eachPath(path => {
                        if (['_id', '__v'].indexOf(path) < 0) {
                            req.doc[path.split('.').shift()] = undefined;
                        }
                    });
                    Object.keys(req.body).forEach(key => req.doc[key] = req.body[key]);
                    utils.replaceObjectIds(this.paths, req.doc)
                    req.doc.save((err, result) => {
                        if (err) return res.status(500).send(err.message);
                        res.send(result);
                        this.emitter.emit('update', { old: oldItem, new: result })
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            });
        });
        this.router.patch(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response) => {
            const oldItem = req.doc.toObject()
            permission.hasUpdatePermission(req, req.doc, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    Object.keys(req.body).forEach(key => req.doc[key] = req.body[key]);
                    utils.replaceObjectIds(this.paths, req.doc)
                    req.doc.save((err, result) => {
                        if (err) return res.status(500).send(err.message);
                        res.send(result);
                        this.emitter.emit('update', { old: oldItem, new: result })
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });

        this.router.delete(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response) => {
            permission.hasDeletePermission(req, req.doc, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    req.doc.remove((err, item) => {
                        if (err) return res.status(400).send(err.message);
                        this._deletePermission(Permission, req.doc._id, (err) => {
                            if (err) return res.status(500).send('Error deleting permissions: ' + err.message);
                            res.send(item);
                            this.emitter.emit('delete', item)
                        })
                    })
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            });
        });


        this.router.use(`${this.route}/:id/permission`, (req: PermissionRequest<T>, res: Response, next) => {
            permission.hasAdminPermission(req, req.doc, (err, hasPermission) => {
                if (err) return res.status(500).send(err.message)
                if (!hasPermission) return res.status(403).send()
                next()
            })
        })

        this.router.get(`${this.route}/:id/permission`, (req: EditRequest<T>, res: Response) => {
            Permission.find({ table, object: req.doc._id, user: { $exists: true } }, (err, docs) => {
                if (err) return res.status(500).send(err.message)
                res.send(docs)
            })
        })

        this.router.use(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response, next) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.params.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                req.doc_perm = doc
                next()
            })
        })

        this.router.get(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response) => {
            res.send(req.doc_perm)
        })

        this.router.post(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response) => {
            if (req.doc_perm) return res.status(402).send('This user has a permission on this object.')
            const permission = new Permission({ ...req.body, table })
            permission.object = req.doc._id
            permission.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(201).send(permission)
            })
        })

        this.router.put(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response) => {
            if (!req.doc_perm) return res.status(404).send(`Object ${req.params.id} not found on ${table} permissions table.`)
            if (req.body.read) req.doc_perm.permission = PermissionEnum.READ
            if (req.body.write) req.doc_perm.permission = PermissionEnum.DELETE
            if (req.body.admin) req.doc_perm.permission = PermissionEnum.ADMIN
            req.doc_perm.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(200).send(req.doc_perm)
            })
        })

        this.router.patch(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response) => {
            if (!req.doc_perm) return res.status(404).send(`Object ${req.doc._id} not found on ${table} permissions table for you.`)
            if (req.body.read) req.doc_perm.permission = PermissionEnum.READ
            if (req.body.write) req.doc_perm.permission = PermissionEnum.DELETE
            if (req.body.admin) req.doc_perm.permission = PermissionEnum.ADMIN
            req.doc_perm.save((err) => {
                if (err) return res.status(500).send(err.message)
                res.status(200).send(req.doc_perm)
            })
        })

        this.router.delete(`${this.route}/:id/permission/user/:user`, (req: EditPermRequest<T>, res: Response) => {
            if (!req.doc_perm) return res.status(404).send(`Object ${req.doc._id} not found on ${table} permissions table for you.`)
            req.doc_perm.remove((err) => {
                if (err) return res.status(500).send(err.message)
                res.send(req.doc_perm)
            })
        })

        return permission
    }
}