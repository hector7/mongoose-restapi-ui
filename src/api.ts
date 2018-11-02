import { Model, SchemaType, Document } from 'mongoose';
import { Router, Request } from 'express'
import { EventEmitter } from 'events';

function isNumber(val) {
    return !isNaN(val)
}
function isInteger(val) {
    return /^\d+$/.test(val);
}
function parseNumberFx(el) {
    let res = parseFloat(el)
    if (isInteger(el))
        res = parseInt(el, 10)
    return res
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

const transformPaths = (paths) => {
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

function getModelProperties(schema) {
    return transformPaths(Object.keys(schema.paths).map((key) => {
        const type = schema.paths[key].constructor.name
        if (type === 'DocumentArray') {
            const children = schema.paths[key].schema
            const labels = Object.keys(children.paths).filter(el => children.paths[el].options.label)
            return {
                name: key,
                type: 'Array',
                label: labels.length > 0 ? labels.shift() : '_id',
                required: schema.requiredPaths(true).indexOf(key) >= 0,
                children: getModelProperties(schema.paths[key].schema)
            }
        }
        return {
            name: key,
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
type ServeOptions = {
    name?: string,
    hasAddPermission?: (Request, Document, HasPermissionCallback) => void,
    hasUpdatePermission?: (Request, Document, HasPermissionCallback) => void,
    hasDeletePermission?: (Request, Document, HasPermissionCallback) => void,
}
type InfoModel = {
    name: string,
    route: string,
    paths: any
}
export default function (router: Router, route: string, model: Model<any>, userOptions?: ServeOptions): { infoModel: InfoModel, emitter: EventEmitter } {
    const emitter = new EventEmitter()
    const options: ServeOptions = (userOptions ? { ...defaultOptions, ...userOptions } : defaultOptions);
    const paths = getModelProperties(model.schema)
    let fullPathTypes = {}
    model.schema.eachPath((path, type: CustomSchemaType) => {
        if (type.instance !== 'ObjectID')
            fullPathTypes[path] = type.instance
    })
    const fullPathNotNumber = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath] !== 'Number')
    const fullPathNumber = Object.keys(fullPathTypes).filter(fullPath => fullPathTypes[fullPath] === 'Number')
    const infoModel = { name: model.modelName, route, paths }

    function getItem(id: string, callback: (err: any, res: any) => void) {
        model.findById(id, (err, result) => {
            if (err && err.name === 'CastError') return model.findOne({ [options.name]: id }, callback);
            callback(err, result);
        });
    };
    type CustomSchemaType = SchemaType & { instance: string }
    function getQuery(query) {
        function parseValue(val, fn = el => el, key = '$in') {
            if (Array.isArray(val))
                return { [key]: val.map(fn) }
            return fn(val)
        }
        if (Object.keys(query).length === 0) return {}
        return {
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
                    if (isnumber) {
                        //const numberPaths = fullPathNumber.map(sk => (parseValue(numbers(sk), containsNumberFx, '$or')))
                        //return {$or: stringPaths.concat(numberPaths)}
                    }
                    return { $or: stringPaths }
                }
                if (fullPathTypes[el] !== undefined) {
                    if (fullPathTypes[el] === 'Number') {
                        return {
                            [el]: parseValue(value, parseNumberFx)
                        }
                    }
                    return {
                        [el]: parseValue(value)
                    }
                }
                throw (new Error(`Key ${el} not found in schema.`))
            })
        }
    }

    router.get(`${route}`, (req, res) => {
        new Promise((resolve, reject) => {
            console.log(JSON.stringify(getQuery(req.query)))
            model.find(getQuery(req.query), (err, result) => {
                if (err) return reject(err)

                resolve(result);
            });
        }).then(result => res.send(result)).catch(error => {
            console.error(error)
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
        options.hasAddPermission(req, item, (err, hasPermission, message) => {
            if (err) return res.status(500).send(err.message);
            if (hasPermission) {
                item.save((err, result) => {
                    if (err) return res.status(500).send(err.message);
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