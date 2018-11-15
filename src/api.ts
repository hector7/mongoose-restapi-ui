import { Model, SchemaType, Document, Types } from 'mongoose';
const { ObjectId } = Types
import { Router, Request } from 'express'
import { EventEmitter } from 'events';
import { ObjectID } from 'bson';

function isNumber(val): boolean {
    return !isNaN(val)
}
function isInteger(val): boolean {
    return /^\d+$/.test(val);
}
function parseNumberFx(el): number {
    let res = parseFloat(el)
    if (isInteger(el))
        res = parseInt(el, 10)
    return res
}
function parseObjectId(el): ObjectID {
    console.log(parseObjectId)
    console.log(new ObjectId(el))
    return new ObjectId(el)
}
function containsStringFx(el) {
    return {
        $regex: `.*${el}.*`,
        $options: 'i'
    }
}
function containsNumberFx({ path, value }) {
    return { $where: `/.*${value}.*/.test(this.${path}})` }
}
const getType = (type: string): string => {
    switch (type) {
        case 'SchemaString': return 'String'
        case 'SchemaNumber': return 'Number'
        default: return type.replace('Schema', '')
    }
}

function transformPaths(paths): [Path] {
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
                children: [{
                    ...el,
                    name: el.name.split('.').slice(1).join('.')
                }].concat(transformPaths(pathsWithObject.slice(key + 1).filter(el => el.name.startsWith(base + '.')).map(el => ({
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
type ObjectPath = FieldPath | {
    complex: true,
    name: string,
    type: 'Object',
    children: [Path]
}
type ArrayPath = FieldPath | {
    complex: true,
    name: string,
    type: 'Array',
    label: string,
    children: [Path]
}
type FieldPath = {
    name: string,
    type: 'Number' | 'String' | 'Boolean' | 'ObjectId',
    required: boolean
}
type Path = ObjectPath | ArrayPath | FieldPath

function getModelProperties(schema): [Path] {
    return transformPaths(Object.keys(schema.paths).map((key) => {
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
                    children: getModelProperties(schema.paths[key].schema)
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
        if (getType(schema.paths[key].constructor.name) === 'Array') {
            console.log(schema.paths[key].caster)
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
                type: 'Array'+schema.paths[key].caster.instance,
                required: schema.requiredPaths(true).indexOf(key) >= 0
            }
        }
        return {
            name: key,
            auto: schema.paths[key].options.auto,
            type: getType(schema.paths[key].constructor.name),
            required: schema.requiredPaths(true).indexOf(key) >= 0
        };
    }));
}
type HasPermissionCallback = (Error, boolean, string?) => void
const defaultOptions = {
    name: 'name',
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
export type ServeOptions = {
    name?: string,
    hasAddPermission?: (Request, Document, HasPermissionCallback) => void,
    hasUpdatePermission?: (Request, Document, HasPermissionCallback) => void,
    hasDeletePermission?: (Request, Document, HasPermissionCallback) => void,
}
type InfoModel = {
    name: string,
    route: string,
    paths: [Path]
}
function replaceObjectIds(paths: [Path], object): void {
    paths.forEach(path => {
        if (path.type === 'Array')
            object[path.name].forEach(subEl => {
                replaceObjectIds(path.children, subEl)
            })
        if (typeof (object[path.name] === 'string')) {
            if (path.type === 'ObjectId') {
                if (object[path.name])
                    object[path.name] = ObjectId(object[path.name])
            }
        }
    })
}
export default function (router: Router, route: string, model: Model<any>, models: any[], userOptions?: ServeOptions): { infoModel: InfoModel, emitter: EventEmitter } {
    const emitter = new EventEmitter()
    const options: ServeOptions = (userOptions ? { ...defaultOptions, ...userOptions } : defaultOptions);
    const paths = getModelProperties(model.schema)
    let fullPathTypes = {}
    function getPath(paths, fullPath) {
        const innerPaths = fullPath.split('.')
        const firstPath = innerPaths.shift()
        const object = paths.find(el => el.name === firstPath)
        if (innerPaths.length === 0)
            return object
        return getPath(object.children, innerPaths.join('.'))
    }
    model.schema.eachPath((path, type: CustomSchemaType) => {
        if (type.instance !== 'ObjectID')
            fullPathTypes[path] = type.instance
        else {
            const pathType = getPath(paths, path)
            if (pathType.type === 'Ref')
                return fullPathTypes[path] = pathType
            fullPathTypes[path] = 'ObjectId'
        }
    })
    const fullPathNotNumber = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath] === 'String')
    const fullPathNumber = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath] === 'Number')
    const numberTransformations = fullPathNumber.length > 0 ? [{
        $addFields: fullPathNumber.map(el => ({
            key: `_string_${el}`,
            value: { $toString: `$${el}` }
        })).reduce((obj, next) => {
            obj[next.key] = next.value
            return obj
        }, {})
    }] : []
    const numberTransformationsPaths = fullPathNumber.map(el => ({
        key: el,
        value: `_string_${el}`
    })).reduce((obj, next) => {
        obj[next.key] = next.value
        return obj
    }, {})
    const infoModel = { name: model.modelName, route, paths, label: options.name, model }

    let refsPaths = null
    function getItem(id: string, callback: (err: any, res: any) => void) {
        if (ObjectId.isValid(id)) {
            model.findById(id, callback)
        } else {
            model.findOne({ [options.name]: id }, callback);
        }
    };
    type CustomSchemaType = SchemaType & { instance: string }
    function getQuery(query): any[] {
        const existAnyOp = Object.keys(query).some(el => el === '$any')
        function parseValue(val, fn = el => el, key = '$in') {
            if (Array.isArray(val))
                return { [key]: val.map(fn) }
            return fn(val)
        }
        const match = {
            $and: Object.keys(query).map(el => {
                const value = query[el]
                if (el === '$any') {
                    const stringPaths = fullPathNotNumber.map(sk => ({ [sk]: parseValue(value, containsStringFx) }))
                    let isnumber = isNumber(value)
                    let numbers: (string) => ({ path: string, value: number } | { path: string, value: number }[]) = path => ({ path, value })
                    if (Array.isArray(value)) {
                        numbers = path => value.filter(isNumber).map(value => ({ path, value }))
                        isnumber = (<{}[]>numbers('')).length > 0
                    }
                    const refsPathsMap = refsPaths.map(sk => ({ [`${sk.name}.${sk.targetLabel}`]: parseValue(value, containsStringFx) }))
                    if (isnumber) {
                        const numberPaths = fullPathNumber.map(sk => ({ [numberTransformationsPaths[sk]]: parseValue(value, containsStringFx) }))
                        //const numberPaths = fullPathNumber.map(sk => (parseValue(numbers(sk), containsNumberFx, '$or')))
                        return { $or: stringPaths.concat(numberPaths).concat(refsPathsMap) }
                    }
                    return { $or: stringPaths.concat(refsPathsMap) }
                }
                if (fullPathTypes[el] !== undefined) {
                    if (fullPathTypes[el] === 'Number') {
                        return {
                            [el]: parseValue(value, parseNumberFx)
                        }
                    }
                    if (fullPathTypes[el].type === 'Ref') {
                        const targetModel = models.find(model => model.name === fullPathTypes[el].to)
                        const targetPath = targetModel.paths.find(path => path.name === targetModel.label)
                        if (targetPath.type === 'Number')
                            return {
                                [`${el}.${targetModel.label}`]: parseValue(value, parseNumberFx)
                            }
                        return {
                            [`${el}.${targetModel.label}`]: parseValue(value)
                        }
                    }
                    if (fullPathTypes[el] === 'ObjectId') {
                        return { [el]: parseValue(value, parseObjectId) }
                    }
                    return {
                        [el]: parseValue(value)
                    }
                }
                throw (new Error(`Key ${el} not found in schema.`))
            })
        }
        let aggregate: any[] = existAnyOp ? numberTransformations : []
        if (Object.keys(query).length === 0) {
            if (aggregate.length === 0)
                return [{ $match: {} }]
            return aggregate
        }
        console.log(match)
        return [...aggregate, { $match: match }]
    }

    router.get(`${route}`, (req, res) => {
        new Promise((resolve, reject) => {
            console.log(JSON.stringify(getQuery(req.query), null, 1))
            model.aggregate(getQuery(req.query), (err, result) => {
                if (err) return reject(err)
                resolve(result);
            });
        }).then(result => res.send(result)).catch(error => {
            res.status(400).send(error.message)
        })
    });
    router.get(`${route}/:id`, (req, res) => {
        getItem(req.params.id, (err, item) => {
            if (err) return res.status(400).send(err.message);
            if (!item) return res.sendStatus(404);
            res.send(item);
        });
    });
    router.post(`${route}`, (req, res) => {
        let item = new model(req.body)
        replaceObjectIds(paths, item)
        options.hasAddPermission(req, item, (err, hasPermission, message) => {
            if (err) return res.status(500).send(err.message);
            if (hasPermission) {
                item.save((err, result) => {
                    if (err) return res.status(400).send(err.message);
                    res.status(201).send(result);
                    emitter.emit('add', result)
                });
            } else {
                res.status(403).send(message ? message : 'Unauthorized')
            }
        })
    });
    router.put(`${route}/:id`, (req, res) => {
        if (typeof (req.body) !== 'object') return res.status(400).send('Body must be a valid JSON')
        getItem(req.params.id, (err, item) => {
            if (err) return res.status(400).send(err.message);
            if (!item) return res.sendStatus(404);
            options.hasUpdatePermission(req, item, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    model.schema.eachPath(path => {
                        if (['_id', '__v'].indexOf(path) < 0) {
                            item[path.split('.').shift()] = undefined;
                        }
                    });
                    Object.keys(req.body).forEach(key => item[key] = req.body[key]);
                    replaceObjectIds(paths, item)
                    item.save((err, result) => {
                        if (err) return res.status(400).send(err.message);
                        res.send(result);
                        emitter.emit('update', result)
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });
    });
    router.patch(`${route}/:id`, (req, res) => {
        getItem(req.params.id, (err, item) => {
            if (err) return res.status(400).send(err.message);
            if (!item) return res.sendStatus(404);
            options.hasUpdatePermission(req, item, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    Object.keys(req.body).forEach(key => item[key] = req.body[key]);
                    replaceObjectIds(paths, item)
                    item.save((err, result) => {
                        if (err) return res.status(400).send(err.message);
                        res.send(result);
                        emitter.emit('update', result)
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });
    });

    router.delete(`${route}/:id`, (req, res) => {
        getItem(req.params.id, (err, item) => {
            if (err) return res.status(400).send(err.message);
            if (!item) return res.sendStatus(404);
            options.hasDeletePermission(req, item, (err, hasPermission, message) => {
                if (err) return res.status(500).send(err.message);
                if (hasPermission) {
                    model.deleteOne({ _id: item._id }, (err) => {
                        if (err) return res.status(400).send(err.message);
                        res.send(item);
                        emitter.emit('delete', item)
                    });
                } else {
                    res.status(403).send(message ? message : 'Unauthorized')
                }
            })
        });
    });
    return { infoModel, emitter }
};