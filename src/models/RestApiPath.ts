import { Model, SchemaType, Document, DocumentQuery } from 'mongoose';
import { Router, Request, Response } from 'express'
import { EventEmitter } from 'events';
import { HasPermissionCallback, ServeOptions, FullPathTypes, Path, InfoModel, ObjectPath } from '../definitions/model'
import * as utils from '../utils'
import getQuery from './query'
import { Cursor } from 'mongodb';


const defaultOptions = {
    MAX_RESULTS: 100,
    name: 'name',
    getPermissionStep: (callback) => {
        callback(null, null)
    },
    hasAddPermission: (req: Request, item: Document, callback: HasPermissionCallback) => {
        callback(null, true)
    },
    hasUpdatePermission: (req: Request, item: Document, callback: HasPermissionCallback) => {
        callback(null, true)
    },
    hasDeletePermission: (req: Request, item: Document, callback: HasPermissionCallback) => {
        callback(null, true)
    }
}

type CustomSchemaType = SchemaType & { instance: string }


const routerWeakMap = new WeakMap()

function getOptions(options: ServeOptions) {
    if (options) {
        const { hasEditPermission, hasAddPermission, hasUpdatePermission, hasDeletePermission } = options
        if (hasEditPermission) {
            const add = hasAddPermission ? hasAddPermission : hasEditPermission
            const updatePermission = hasUpdatePermission ? hasUpdatePermission : hasEditPermission
            const deletePermission = hasDeletePermission ? hasDeletePermission : hasEditPermission
            return { ...defaultOptions, ...options, hasAddPermission: add, hasUpdatePermission: updatePermission, hasDeletePermission: deletePermission }
        }
        return { ...defaultOptions, ...options }
    }
    return defaultOptions
}

export default class RestApiPath {

    private _route: string
    private _model: Model<any>
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
    constructor(router: Router, route: string, model: Model<any>, options: ServeOptions) {
        routerWeakMap.set(this, router)
        this._options = getOptions(options)
        this._route = route
        this._model = model
        this._emitter = new EventEmitter()
        this._paths = this.getModelProperties(model.schema)
        this.generateFullPathTypes()
    }

    get MAX_RESULTS(): number {
        return this.options.MAX_RESULTS
    }

    get emitter(): EventEmitter {
        return this._emitter
    }

    get model(): Model<any> {
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

    private generateFullPathTypes() {
        const fullPathTypes = this.getFullPathTypes()
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

    private getType = (type: string): string => {
        return type.replace('Schema', '')
    }

    private transformPaths(paths): [Path] {
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
                    }].concat(this.transformPaths(pathsWithObject.slice(key + 1).filter(el => el.name.startsWith(base + '.')).map(el => ({
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

    private getModelProperties(schema): Path[] {
        return this.transformPaths(Object.keys(schema.paths).map((key) => {
            const type = schema.paths[key].constructor.name
            if (type === 'DocumentArray') {
                const children = schema.paths[key].schema
                const labels = Object.keys(children.paths).filter(el => children.paths[el].options.label)
                if (schema.paths[key].schema !== undefined) {
                    return {
                        name: key,
                        type: 'Array',
                        label: labels.length > 0 ? labels.shift() : '_id',
                        required: schema.requiredPaths(true).indexOf(key) >= 0,
                        children: this.getModelProperties(schema.paths[key].schema)
                    }
                }
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
                type: this.getType(schema.paths[key].constructor.name),
                required: schema.requiredPaths(true).indexOf(key) >= 0
            };
        }));
    }

    private getFullPathTypes(): FullPathTypes {
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
        this.options.getPermissionStep((err, query) => {
            if (err) return callback(err)
            const cb = (err, res) => {
                if (err) return callback(err)
                if (query === null) return callback(null, res)
                this.model.findOne({ _id: res._id }).findOne(query, callback)
            }
            return this.model.findById(id, (err, res) => {
                if (err || !res) {
                    return this.model.findOne({ [this.options.name]: id }, cb)
                }
                return cb(err, res)
            })
        })
    }

    public setEndPoints(models) {
        const { hasAddPermission, hasUpdatePermission, hasDeletePermission } = this.options
        this.router.use((req, res, next) => {
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
        this.router.get(`${this.route}`, (req: Request, res: Response) => {
            this.options.getPermissionStep((err, query) => {
                if (err) return res.status(500).send(err.message)
                const { $page, $rowsPerPage, $sort, $sortBy, ...others } = req.query
                getQuery(models, this.model, this, others, query, (err, cursor: DocumentQuery<any, any>) => {
                    if (err) return res.status(500).send(err.message)
                    cursor.count((err, count) => {
                        if (err) return res.status(500).send(err.message)
                        const page = $page ? $page : 1
                        const rowsPerPage = $rowsPerPage ? $rowsPerPage : this.MAX_RESULTS
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
        this.router.get(`${this.route}/:id`, (req: Request, res: Response) => {
            this.getItem(req.params.id, (err, item) => {
                if (err) return res.status(500).send(err.message);
                if (!item) return res.sendStatus(404);
                res.send(item);
            });
        });
        this.router.post(`${this.route}`, (req: Request, res: Response) => {
            let item = new this.model(req.body)
            utils.replaceObjectIds(this.paths, item)
            hasAddPermission(req, item, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    item.save((err, result) => {
                        if (err) return res.status(500).send(err.message);
                        res.status(201).send(result);
                        this.emitter.emit('add', result)
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });
        this.router.put(`${this.route}/:id`, (req: Request, res: Response) => {
            this.getItem(req.params.id, (err, item) => {
                if (err) return res.status(500).send(err.message);
                if (!item) return res.sendStatus(404);
                const oldItem = JSON.parse(JSON.stringify(item))
                hasUpdatePermission(req, item, (err, hasPermission, message) => {
                    if (err) return res.status(500).send(err.message);
                    if (hasPermission) {
                        this.model.schema.eachPath(path => {
                            if (['_id', '__v'].indexOf(path) < 0) {
                                item[path.split('.').shift()] = undefined;
                            }
                        });
                        Object.keys(req.body).forEach(key => item[key] = req.body[key]);
                        utils.replaceObjectIds(this.paths, item)
                        item.save((err, result) => {
                            if (err) return res.status(500).send(err.message);
                            res.send(result);
                            this.emitter.emit('update', { old: oldItem, new: result })
                        });
                    } else {
                        res.status(403).send(message ? message : 'Unauthorized')
                    }
                })
            });
        });
        this.router.patch(`${this.route}/:id`, (req: Request, res: Response) => {
            this.getItem(req.params.id, (err, item) => {
                if (err) return res.status(500).send(err.message);
                if (!item) return res.sendStatus(404);
                const oldItem = JSON.parse(JSON.stringify(item))
                hasUpdatePermission(req, item, (err, hasPermission, message) => {
                    if (err) return res.status(500).send(err.message);
                    if (hasPermission) {
                        Object.keys(req.body).forEach(key => item[key] = req.body[key]);
                        utils.replaceObjectIds(this.paths, item)
                        item.save((err, result) => {
                            if (err) return res.status(500).send(err.message);
                            res.send(result);
                            this.emitter.emit('update', { old: oldItem, new: result })
                        });
                    } else {
                        res.status(403).send(message ? message : 'Unauthorized')
                    }
                })
            });
        });

        this.router.delete(`${this.route}/:id`, (req: Request, res: Response) => {
            this.getItem(req.params.id, (err, item) => {
                if (err) return res.status(400).send(err.message);
                if (!item) return res.sendStatus(404);
                hasDeletePermission(req, item, (err, hasPermission, message) => {
                    if (err) return res.status(500).send(err.message);
                    if (hasPermission) {
                        this.model.deleteOne({ _id: item._id }, (err) => {
                            if (err) return res.status(400).send(err.message);
                            res.send(item);
                            this.emitter.emit('delete', item)
                        });
                    } else {
                        res.status(403).send(message ? message : 'Unauthorized')
                    }
                })
            });
        });
    }
}