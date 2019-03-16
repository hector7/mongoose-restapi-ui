import { Model, SchemaType, Document, DocumentQuery, Types } from 'mongoose';
import { Router, Request, Response } from 'express'
import { EventEmitter } from 'events';
import { HasPermissionCallback, ServeOptions, FullPathTypes, Path, InfoModel, ObjectPath, PermissionRequest, EditRequest, UserRequest, PermissionEnum } from '../definitions/model'
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
    getQuery: (user: IUser, callback) => {
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
    private _convertStep: any = []
    private _transformationMap: { [key: string]: string } = {}
    private _projectionStep: { $project: { [key: string]: 1 } }
    private _fullPathTypes: FullPathTypes
    constructor(router: Router, route: string, model: Model<T>, options: ServeOptions) {
        routerWeakMap.set(this, router)
        this._options = getOptions(options)
        this._route = route
        this._model = model
        this._emitter = new EventEmitter()
        this._paths = this._getModelProperties(model.schema)
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

    get transformationMap() {
        return this._transformationMap
    }

    get convertStep() {
        return this._convertStep
    }

    get projectionStep() {
        return this._projectionStep
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

    isNumber(path: string): boolean {
        return this._numberFullPaths.indexOf(path) >= 0
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
        const otherFullPaths = Object.keys(fullPathTypes).filter(fullPath => this.stringFullPaths.indexOf(fullPath) < 0 && this.refFullPaths.indexOf(fullPath) < 0)
        const usedPaths = [...Object.keys(fullPathTypes)]
        function getPath(path) {
            const newPath = `_${path}`
            if (usedPaths.indexOf(newPath) < 0) {
                usedPaths.push(newPath)
                return newPath
            }
            return getPath(newPath)
        }
        if (otherFullPaths.length > 0) {
            this._transformationMap = otherFullPaths.map(el => ({
                key: el,
                value: getPath(el)
            })).reduce((obj, next) => {
                obj[next.key] = next.value
                return obj
            }, {})
            this._convertStep = {
                $addFields: otherFullPaths.map(el => ({
                    key: this.transformationMap[el],
                    value: { $toString: `$${el}` }
                })).reduce((obj, next) => {
                    obj[next.key] = next.value
                    return obj
                }, {})
            }
        }
        this._projectionStep = {
            $project: Object.keys(fullPathTypes).reduce((obj, next) => {
                obj[next] = 1
                return obj
            }, {})
        }
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
                        name: el.name.split('.').slice(1).join('.')
                    }].concat(this._transformPaths(pathsWithObject.slice(key + 1).filter(el => el.name.startsWith(base + '.')).map(el => ({
                        ...el,
                        name: el.name.slice(base.length + 1)
                    }))))
                }
                pathsWithObject.slice(1).filter(el => el.name.startsWith(base + '.')).forEach(el => {
                    visited.push(el)
                })
                newObjects.push(newObject)
            }
        })
        return pathsWithoutObject.concat(newObjects)
    }

    private _getModelProperties(schema): Path[] {
        return this._transformPaths(Object.keys(schema.paths).map((key) => {
            const type = schema.paths[key].constructor.name
            if (type === 'DocumentArray') {
                const children = schema.paths[key].schema
                const labels = Object.keys(children.paths).filter(el => children.paths[el].options.label)
                // TODO Check if documentarray ever has schema object
                //if (schema.paths[key].schema !== undefined) {
                return {
                    name: key,
                    type: 'Array',
                    complex: true,
                    label: labels.length > 0 ? labels.shift() : '_id',
                    required: schema.requiredPaths(true).indexOf(key) >= 0,
                    children: this._getModelProperties(schema.paths[key].schema)
                }
                //}
            }
            if (type === 'ObjectId' && schema.paths[key].options.ref !== undefined) {
                return {
                    name: key,
                    type: 'Ref',
                    to: schema.paths[key].options.ref
                }
            }

            if (schema.paths[key].caster) {
                if (schema.paths[key].caster.options.ref) {
                    return {
                        name: key,
                        type: 'ArrayRef',
                        required: schema.requiredPaths(true).indexOf(key) >= 0,
                        to: schema.paths[key].caster.options.ref
                    }
                }
                return {
                    name: key,
                    auto: schema.paths[key].options.auto,
                    type: 'Array' + schema.paths[key].caster.instance,
                    required: schema.requiredPaths(true).indexOf(key) >= 0
                }
            }
            return {
                name: key,
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

    public getItem(id: string, callback: (err?: Error, res?: T) => void): void {
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
        if (!Permission) return callback(null)
        let p = new Permission({ table, object, user: req.user._id, permission: PermissionEnum.DELETE })
        p.save(callback)
    }
    private _deletePermission(Permission: Model<IPermission>, object: Types.ObjectId, callback: (err: Error) => void) {
        const table = this.model.modelName
        if (Permission) return Permission.deleteMany({ table, object }, callback)
        callback(null)
    }

    public setEndPoints(models, Permission: Model<IPermission>, Role: Model<IRole>) {
        const permission = new PermissionClass(this.model, Permission, Role, this.options)
        const table = this.model.modelName
        this.router.use(this.route, (req, res, next) => {
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
                    next()
                }
            })
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
            permission.getReadQuery(req.user, (err, query) => {
                if (err) return res.status(500).send(err.message)
                const { $page, $rowsPerPage, $sort, $sortBy, ...others } = req.query
                getQuery(models, this.model, this, others, query, (err, cursor: DocumentQuery<T, T>) => {
                    if (err) return res.status(500).send(err.message)
                    cursor.count((err, count) => {
                        if (err) return res.status(500).send(err.message)
                        const page = $page ? $page : 1
                        const rowsPerPage = $rowsPerPage ? parseInt($rowsPerPage) : this.MAX_RESULTS
                        if ($sortBy) {
                            cursor = cursor.sort({ [$sortBy]: $sort ? $sort : 1 })
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
                                    results
                                })
                            })
                    })
                })
            })
        });
        this.router.get(`${this.route}/:id`, (req: PermissionRequest<T>, res: Response) => {
            permission.hasReadPermission(req.user, req.doc, (err, hasPermission, reason) => {
                if (err) res.status(500).send(err.message)
                if (!hasPermission) return res.status(403).send()
                res.send(req.doc);
            })
        });
        this.router.post(`${this.route}`, (req: PermissionRequest<T>, res: Response) => {
            if(!req.body) return res.status(401).send('body is empty')
            let item = new this.model(req.body)
            utils.replaceObjectIds(this.paths, item)
            permission.hasAddPermission(req.user, (err, hasPermission, message) => {
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
            if(!req.body) return res.status(401).send('body is empty')
            const oldItem = req.doc.toObject()
            permission.hasUpdatePermission(req.user, req.doc, (err, hasPermission, message) => {
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
            if(!req.body) return res.status(401).send('body is empty')
            const oldItem = req.doc.toObject()
            permission.hasUpdatePermission(req.user, req.doc, (err, hasPermission, message) => {
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
            permission.hasDeletePermission(req.user, req.doc, (err, hasPermission, message) => {
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
            permission.hasAdminPermission(req.user, req.doc, (err, hasPermission) => {
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

        this.router.get(`${this.route}/:id/permission/user/:user`, (req: EditRequest<T>, res: Response) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.params.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                res.send(doc)
            })
        })

        this.router.post(`${this.route}/:id/permission/user`, (req: EditRequest<T>, res: Response) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.body.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                if (doc) return res.status(402).send('This user has a permission on this object.')
                const permission = new Permission({ ...req.body, table })
                permission.object = req.doc._id
                permission.save((err) => {
                    if (err) return res.status(500).send(err.message)
                    res.status(201).send(permission)
                })
            })
        })

        this.router.put(`${this.route}/:id/permission/user/:user`, (req: EditRequest<T>, res: Response) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.params.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                if (!doc) return res.status(404).send(`Object ${req.params.id} not found on ${table} permissions table.`)
                if (req.body.read) doc.permission = PermissionEnum.READ
                if (req.body.write) doc.permission = PermissionEnum.DELETE
                if (req.body.admin) doc.permission = PermissionEnum.ADMIN
                doc.save((err) => {
                    if (err) return res.status(500).send(err.message)
                    res.status(200).send(doc)
                })
            })
        })

        this.router.patch(`${this.route}/:id/permission/user/:user`, (req: EditRequest<T>, res: Response) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.params.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                if (!doc) return res.status(404).send(`Object ${req.doc._id} not found on ${table} permissions table for you.`)
                if (req.body.read) doc.permission = PermissionEnum.READ
                if (req.body.write) doc.permission = PermissionEnum.DELETE
                if (req.body.admin) doc.permission = PermissionEnum.ADMIN
                doc.save((err) => {
                    if (err) return res.status(500).send(err.message)
                    res.status(200).send(doc)
                })
            })
        })

        this.router.delete(`${this.route}/:id/permission/user/:user`, (req: EditRequest<T>, res: Response) => {
            Permission.findOne({ table, object: req.doc._id, user: Types.ObjectId(req.params.user) }, (err, doc) => {
                if (err) return res.status(500).send(err.message)
                if (!doc) return res.status(404).send(`Object ${req.doc._id} not found on ${table} permissions table for you.`)
                doc.remove((err) => {
                    if (err) return res.status(500).send(err.message)
                    res.send(doc)
                })
            })
        })
        return permission
    }
}