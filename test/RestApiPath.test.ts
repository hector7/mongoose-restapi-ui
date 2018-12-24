import { suite, test } from "mocha-typescript";

var mock = require('mock-require')
import express = require('express')
import { Router } from 'express';
import RestApiPath from '../src/models/RestApiPath'
import { Connection, Model, Query, Schema } from "mongoose";
import permissionSchema, { IPermission } from "../src/models/permissionSchema";
import { UserRequest } from "../src/definitions/model";
const mongoose = require("mongoose");

let chai = require('chai')
let chaiHttp = require('chai-http');
chai.use(chaiHttp)
chai.should();

@suite('RestApi path test')
class RestApiPathTest {
    static connection: Connection
    static route = '/test'
    static id: string
    static model: Model<any>
    static permission: Model<IPermission>
    public static before(done) {
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_restapipath";
        RestApiPathTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
        RestApiPathTest.permission = RestApiPathTest.connection.model('perm', permissionSchema)
        RestApiPathTest.model = RestApiPathTest.connection.model('test1', new mongoose.Schema({
            string: String,
            number: Number,
            date: Date,
            array: [{ number: Number }]
        }))
        const model = RestApiPathTest.model
        let item = new model({ string: 'string', number: 1, date: new Date(), array: [{ number: 1 }] })
        RestApiPathTest.id = item._id
        item.save((err) => {
            if (err) return done(err)
            done()
        })
    }
    public static after(done) {
        RestApiPathTest.connection.dropDatabase((err) => {
            RestApiPathTest.connection.close((error) => {
                if (err) return done(err)
                if (error) return done(error)
                done(error)
            })
        })
    }
    @test "constructor populates objects to getters"() {
        const router = Router()
        let objectTest = new RestApiPath(router, RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.router.should.equal(router)
        objectTest.route.should.equal(RestApiPathTest.route)
        objectTest.model.should.equal(RestApiPathTest.model)
        objectTest.options.name.should.equal('name')
        objectTest.paths.length.should.equal(6)
        objectTest.paths[0].name.should.equal('string')
        objectTest.paths[1].name.should.equal('number')
        objectTest.paths[2].name.should.equal('date')
        objectTest.paths[3].name.should.equal('array')
        objectTest.paths[4].name.should.equal('_id')
        objectTest.paths[5].name.should.equal('__v')
        objectTest.numberFullPaths.length.should.equal(3)
        objectTest.numberFullPaths[0].should.equal('number')
        objectTest.numberFullPaths[1].should.equal('array.number')
        objectTest.stringFullPaths.length.should.equal(1)
        objectTest.stringFullPaths[0].should.equal('string')
        objectTest.dateFullPaths.length.should.equal(1)
        objectTest.dateFullPaths[0].should.equal('date')
        objectTest.arrayFullPaths.length.should.equal(0)
        objectTest.objectIdFullPaths.should.exist
        objectTest.booleanFullPaths.should.exist
        objectTest.convertStep.should.exist
        objectTest.projectionStep.should.exist
        objectTest.fullPathTypes.should.exist
        objectTest.isNumber('array.number').should.equal(true)
        objectTest.setEndPoints([], null)
    }
    @test "constructor with strings has no mapped attributes"() {
        const router = Router()
        const model = RestApiPathTest.connection.model('testsimple', new mongoose.Schema({
            _id: String,
            string: String
        }, { versionKey: false }))
        let objectTest = new RestApiPath(router, RestApiPathTest.route, model, {})
        objectTest.router.should.equal(router)
        objectTest.route.should.equal(RestApiPathTest.route)
        objectTest.options.name.should.equal('name')
        objectTest.paths.length.should.equal(2)
        objectTest.paths[0].name.should.equal('_id')
        objectTest.numberFullPaths.length.should.equal(0)
        objectTest.stringFullPaths.length.should.equal(2)
        objectTest.stringFullPaths[0].should.equal('_id')
        objectTest.stringFullPaths[1].should.equal('string')
        objectTest.dateFullPaths.length.should.equal(0)
        objectTest.arrayFullPaths.length.should.equal(0)
        objectTest.objectIdFullPaths.should.exist
        objectTest.booleanFullPaths.should.exist
        objectTest.convertStep.should.exist
        objectTest.projectionStep.should.exist
        objectTest.fullPathTypes.should.exist
        objectTest.isNumber('array.number').should.equal(false)
        objectTest.setEndPoints([], null)
    }
    @test "generates correct label from array"() {
        const router = Router()
        const model = RestApiPathTest.connection.model('testarraysimple', new mongoose.Schema({
            array: [{ number: { type: Number, label: true } }]
        }, { versionKey: false }))
        let objectTest = new RestApiPath(router, RestApiPathTest.route, model, {})
        const path = objectTest.paths[0]
        path.type.should.be.equal('Array')
        if (path.type === 'Array' && path.complex) {
            path.label.should.be.equal('number')
            path.complex.should.be.true
            path.children.length.should.be.equal(2)
            path.children[0].name.should.be.equal('number')
            path.children[0].type.should.be.equal('Number')
            path.children[1].name.should.be.equal('_id')
        } else {
            path.should.equal('array path must be complex')
        }
    }
    @test "edit permission works propertly with his priority hierarchy"() {
        const router = Router()
        const hasEditPermission = (err, res, callback) => {
            callback('1')
        }
        const hasAddPermission = (err, res, callback) => {
            callback('2')
        }
        let objectTest = new RestApiPath(router, RestApiPathTest.route, RestApiPathTest.model, { hasEditPermission, hasAddPermission })
        objectTest.options.hasAddPermission(null, null, (err, doc) => {
            err.should.equals('2', 'add should be equal to his function provided')
        })
        objectTest.options.hasUpdatePermission(null, null, (err) => {
            err.should.equals('1', 'update should be equal to edit, no provided function')
        })
        objectTest.options.hasDeletePermission(null, null, (err) => {
            err.should.equals('1', 'delete should be equal to edit, no provided function')
        })
        let objectTest2 = new RestApiPath(router, RestApiPathTest.route, RestApiPathTest.model, { hasEditPermission, hasDeletePermission: hasAddPermission, hasUpdatePermission: hasAddPermission })
        objectTest2.options.hasAddPermission(null, null, (err, doc) => {
            err.should.equals('1', 'add should be equal to edit')
        })
        objectTest2.options.hasUpdatePermission(null, null, (err) => {
            err.should.equals('2', 'update should be equal to his function')
        })
        objectTest2.options.hasDeletePermission(null, null, (err) => {
            err.should.equals('2', 'delete should be equal to his function')
        })
    }
    @test "generates correct numberMapping"() {
        const newModel = mongoose.model('testTree3', new Schema({
            _arrayNumber: [{ type: Number }],
            arrayNumber: [{ type: Number }],
        }))
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, newModel, {})
        objectTest.transformationMap._arrayNumber.should.equal('__arrayNumber')
        objectTest.transformationMap.arrayNumber.should.equal('___arrayNumber')
    }
    @test "generates correct tree from model"() {
        const newModel = mongoose.model('testTree', new Schema({
            ref: { type: Schema.Types.ObjectId, ref: 'totest' },
            arrayNumber: [{ type: Number }],
            arrayRef: [{ type: Schema.Types.ObjectId, ref: 'totest2' }],
            complex: {
                number: Number,
                string: String
            }
        }))
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, newModel, {})
        objectTest.refFullPaths.length.should.equal(2)
    }
    @test "generates correct tree from model without Object.assign"() {
        const _assign = Object.assign
        Object.assign = null
        const RestApiPath = mock.reRequire('../src/models/RestApiPath').default
        const newModel = mongoose.model('testTree2', new Schema({
            ref: { type: Schema.Types.ObjectId, ref: 'totest' },
            arrayNumber: [{ type: Number }],
            arrayRef: [{ type: Schema.Types.ObjectId, ref: 'totest2' }],
            complex: {
                number: Number,
                string: String
            }
        }))
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, newModel, {})
        objectTest.refFullPaths.length.should.equal(2)
        Object.assign = _assign
    }
    @test "getItemWithPermissions handle correctly the errors"(done) {
        let hasAdminPermission = (req, doc, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission })
        const s: any = { user: { _id: RestApiPathTest.id } }
        objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err) => {
            err.should.be.equal('some error')
            hasAdminPermission = (req, doc, callback) => {
                callback(null, false)
            }
            let hasUpdatePermission = (req, doc, callback) => {
                callback('some error')
            }
            objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission, hasUpdatePermission })
            objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err) => {
                err.should.be.equal('some error')
                hasUpdatePermission = (req, doc, callback) => {
                    callback(null, true)
                }
                objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission, hasUpdatePermission })
                objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err, res) => {
                    if (err) return done(err)
                    if (!res) return done('object must exist')
                    res._id.toString().should.be.equal(RestApiPathTest.id.toString())

                    hasUpdatePermission = (req, doc, callback) => {
                        callback(null, false)
                    }
                    objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission, hasUpdatePermission })
                    objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err, res) => {
                        if (err) return done(err)
                        if (res) return done('object must not exist')

                        objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission, hasUpdatePermission })
                        objectTest.getPermissionStep = (req, perm, callback) => {
                            callback(new Error('some error'))
                        }
                        objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err) => {
                            err.message.should.be.equal('some error')
                            objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAdminPermission, hasUpdatePermission })
                            objectTest.getPermissionStep = (req, perm, callback) => {
                                callback(null, null)
                            }
                            objectTest.getItemWithPermissions(s, RestApiPathTest.permission, RestApiPathTest.id, (err, res) => {
                                if (err) return done(err)
                                if (res) return done('object must be null')
                                done()
                            })
                        })
                    })
                })
            })
        })
    }
    @test "getPermissionStep handle correctly the errors"(done) {
        let getPermissionStep = (req, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
        const s: any = { user: { _id: RestApiPathTest.id } }
        objectTest.getPermissionStep(s, RestApiPathTest.permission, (err) => {
            err.should.be.equal('some error')
        })
        getPermissionStep = (req, callback) => {
            callback(null, null)
        }
        objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
        const perm = mongoose.model('p', permissionSchema)
        perm.find = (object, proj, callback) => {
            callback('some error')
        }
        objectTest.getPermissionStep(s, perm, (err) => {
            err.should.be.equal('some error')
        })
        RestApiPathTest.permission.insertMany([{ user: RestApiPathTest.id, object: RestApiPathTest.id, table: RestApiPathTest.model.modelName }], (err) => {
            if (err) return done(err)
            objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
            objectTest.getPermissionStep(s, RestApiPathTest.permission, (err, query) => {
                if (err) return done(err)
                JSON.stringify(query).should.be.equal(JSON.stringify({ _id: { $in: [RestApiPathTest.id] } }))

                getPermissionStep = (req, callback) => {
                    callback(null, 'some query')
                }
                objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
                objectTest.getPermissionStep(s, RestApiPathTest.permission, (err, query) => {
                    if (err) return done(err)
                    JSON.stringify(query).should.be.equal(JSON.stringify({ $and: ['some query', { _id: { $in: [RestApiPathTest.id] } }] }))
                    done()
                })
            })
        })
    }
    @test "get all objects"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test "get all objects with filter"(done) {
        const getPermissionStep = (req, callback) => {
            callback(null, { string: 'string' })
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}?$page=1&$any=string&$sortBy=string&$sort=asc`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test "get all objects with sort"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}?$sortBy=hector`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test "get all objects handle error from getQuery"(done) {
        mock('../src/models/query', './query.error.mock')
        const RestApiPath = mock.reRequire('../src/models/RestApiPath').default
        mock.stop('../src/models/query')
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "get all objects handle error from count"(done) {
        mock('../src/models/query', './query_count.error.mock')
        const RestApiPath = mock.reRequire('../src/models/RestApiPath').default
        mock.stop('../src/models/query')
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "get all objects handle error from find"(done) {
        mock('../src/models/query', './query_find.error.mock')
        const RestApiPath = mock.reRequire('../src/models/RestApiPath').default
        mock.stop('../src/models/query')
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "get all objects handle error from getPermissionStep"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.getPermissionStep = (req, perm, callback) => {
            callback(new Error('some error'))
        }
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}?$sortBy=hector`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "post object handle error from addPermission"(done) {
        const hasAddPermission = (req, doc, callback) => {
            req.user = { _id: RestApiPathTest.id }
            callback(null, true)
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAddPermission })
        const m = mongoose.model('permFake', permissionSchema)
        m.prototype.save = (callback) => callback('some error')
        objectTest1.setEndPoints([], m)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .post(`${RestApiPathTest.route}`)
                .send(JSON.stringify(new RestApiPathTest.model({})))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "get an object by id"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}/${RestApiPathTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test "get an object by id that not exist"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}/1`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(404)
                        done()
                    })
                })
        })
    }
    @test "get an object by id getItem handle error"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.getItem = (id, callback): Query<any> => {
            callback(new Error('no passed'))
            return null
        }
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}/1`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test("check hasAddPermission works")
    public hasAddPermission(done) {
        const hasAddPermission = (req, doc, callback) => {
            callback(null, false)
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAddPermission })
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .post(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(403)
                        done()
                    })
                })
        })
    }
    @test "check hasAddPermission message works"(done) {
        const hasAddPermission = (req, doc, callback) => {
            callback(null, false, 'some error')
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAddPermission })
        objectTest1.setEndPoints([], null)
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .post(`${RestApiPathTest.route}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(403)
                        //res.should.have.statusText('some error')
                        done()
                    })
                })
        })
    }
    @test "check hasAddPermission handle error"(done) {
        const hasAddPermission = (req, doc, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasAddPermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .post(`/test`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check post save handle error"(done) {
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, object) => {
            if (err) return done(err)
            let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
            objectTest.model.prototype.save = (callback) => callback('some error')
            objectTest.setEndPoints([], null)
            const app = express()
            app.use('/', objectTest.router)
            const server = app.listen(3003, () => {
                chai.request(server)
                    .post(`/test`)
                    .send(JSON.stringify(object))
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check handle error on put method find mongo id"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.getItem = (id, callback): Query<any> => {
            callback(new Error('no passed'))
            return null
        }

        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .put(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test("check hasUpdatePermission put works")
    public hasUpdatePermission(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback(null, false)
        }
        let objectTest2 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        const app2 = express()
        objectTest2.setEndPoints([], null)
        app2.use('/', objectTest2.router)
        const server = app2.listen(3002, () => {
            chai.request(server)
                .put(`${RestApiPathTest.route}/${RestApiPathTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(403)
                        done()
                    })
                })
        })
    }
    @test "check hasUpdatePermission message put works"(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback(null, false, 'some error')
        }
        let objectTest2 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        const app2 = express()
        objectTest2.setEndPoints([], null)
        app2.use('/', objectTest2.router)
        const server = app2.listen(3002, () => {
            chai.request(server)
                .put(`${RestApiPathTest.route}/${RestApiPathTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(403)
                        done()
                    })
                })
        })
    }
    @test "check handle put by no item"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .put(`/test/1`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(404)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission put handle error"(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .put(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission put save handle error"(done) {
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, object) => {
            if (err) return done(err)
            let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
            objectTest.getItem = (id, callback) => {
                object.save = (callback) => callback('some error')
                return callback(null, object)
            }
            objectTest.setEndPoints([], null)
            const app = express()
            app.use('/', objectTest.router)
            const server = app.listen(3003, () => {
                chai.request(server)
                    .put(`/test/${RestApiPathTest.id}`)
                    .send(JSON.stringify(object))
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check handle error on patch method find mongo id"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})

        objectTest.getItem = (id, callback): Query<any> => {
            callback(new Error('no passed'))
            return null
        }

        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .patch(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission patch works"(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback(null, false)
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .patch(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(403)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission message patch works"(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback(null, false, 'some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .patch(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(403)
                            done()
                        })
                    })
            })
        })
    }
    @test "check handle patch by no item"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .patch(`/test/1`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(404)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission patch handle error"(done) {
        const hasUpdatePermission = (req, doc, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasUpdatePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .patch(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasUpdatePermission patch save handle error"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.getItem = (id, callback) => {
            RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
                if (err) return callback(err)
                res.save = (callback) => callback('some error')
                return callback(null, res)
            })
        }
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathTest.id}`)
                .send('{}')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test "check handle error on delete method find mongo id"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})

        objectTest.getItem = (id, callback): Query<any> => {
            callback(new Error('no passed'))
            return null
        }

        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test("check hasDeletePermission works")
    public hasDeletePermission(done) {
        const hasDeletePermission = (req, doc, callback) => {
            callback(null, false)
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasDeletePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(403)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasDeletePermission message works"(done) {
        const hasDeletePermission = (req, doc, callback) => {
            callback(null, false, 'some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasDeletePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(403)
                            done()
                        })
                    })
            })
        })
    }
    @test "check handle delete by no item"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/1`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(404)
                            done()
                        })
                    })
            })
        })
    }
    @test "check hasDeletePermission handle error"(done) {
        const hasDeletePermission = (req, doc, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasDeletePermission })
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(500)
                            done()
                        })
                    })
            })
        })
    }
    @test "check handle error on delete mongo id"(done) {
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest.getItem = (id, callback): Query<any> => {
            callback(null, { remove: (callback) => callback('no passed') })
            return null
        }
        objectTest.setEndPoints([], null)
        const app = express()
        app.use('/', objectTest.router)
        RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
            const server = app.listen(3003, () => {
                chai.request(server)
                    .delete(`/test/${RestApiPathTest.id}`)
                    .send('')
                    .end((err, res) => {
                        server.close((err) => {
                            res.should.have.status(400)
                            done()
                        })
                    })
            })
        })
    }
    @test "check deletePermissions handle error"(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasDeletePermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathTest.route, RestApiPathTest.model, { hasDeletePermission })
        const perm: any = { deleteMany: (a, callback) => callback('some error') }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .delete(`/test/${RestApiPathTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
}

@suite('RestApi path permissions api rest test')
class RestApiPathPermissionRootTest {
    static connection: Connection
    static route = '/test'
    static id: string
    static model: Model<any>
    static permission: Model<IPermission>
    public static before(done) {
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_restapipermissionspath";
        RestApiPathPermissionRootTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
        RestApiPathPermissionRootTest.permission = RestApiPathPermissionRootTest.connection.model('perm', permissionSchema)
        RestApiPathPermissionRootTest.model = RestApiPathPermissionRootTest.connection.model('test1', new mongoose.Schema({
            string: String,
            number: Number,
            date: Date,
            array: [{ number: Number }]
        }))
        const model = RestApiPathPermissionRootTest.model
        let item = new model({ string: 'string', number: 1, date: new Date(), array: [{ number: 1 }] })
        RestApiPathPermissionRootTest.id = item._id
        item.save((err) => {
            if (err) return done(err)
            done()
        })
    }
    public static after(done) {
        RestApiPathPermissionRootTest.connection.dropDatabase((err) => {
            RestApiPathPermissionRootTest.connection.close((error) => {
                if (err) return done(err)
                if (error) return done(error)
                done(error)
            })
        })
    }
    @test 'getpermissions as root'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathPermissionRootTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        objectTest.setEndPoints([], RestApiPathPermissionRootTest.permission)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'getpermissions from one user without admin permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, false)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        objectTest.setEndPoints([], RestApiPathPermissionRootTest.permission)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(403)
                        done()
                    })
                })
        })
    }
    @test 'getpermissions from one user with error on admin permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback('some error')
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        objectTest.setEndPoints([], RestApiPathPermissionRootTest.permission)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'getpermissions from one user with error on find permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFaje', permissionSchema)
        perm.find = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'getpermissions from from user'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'getpermissions from from user with error'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFaje', permissionSchema)
        perm.findOne = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .get(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'put permission without entry'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .put(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(404)
                        done()
                    })
                })
        })
    }
    @test 'patch permission without entry'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(404)
                        done()
                    })
                })
        })
    }
    @test 'delete permission without entry'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .delete(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(404)
                        done()
                    })
                })
        })
    }
    @test 'add permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .post(`/test/${RestApiPathPermissionRootTest.id}/permission/user`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(201)
                        done()
                    })
                })
        })
    }
    @test 'add permission with duplicate entry'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .post(`/test/${RestApiPathPermissionRootTest.id}/permission/user`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(402)
                        done()
                    })
                })
        })
    }
    @test 'add permission with error on find'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFake', permissionSchema)
        perm.findOne = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .post(`/test/${RestApiPathPermissionRootTest.id}/permission/user`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'add permission with error on save'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        class FakePerm {
            save(callback) {
                callback('sme error')
            }
            static findOne(arg, callback) {
                callback(null, null)
            }
        }
        const perm: any = FakePerm
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .post(`/test/${RestApiPathPermissionRootTest.id}/permission/user`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'put permission with error on save'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        class FakePerm {
            save(callback) {
                callback('sme error')
            }
            static findOne(arg, callback) {
                callback(null, new FakePerm())
            }
        }
        const perm: any = FakePerm
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .put(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'patch permission with error on save'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        class FakePerm {
            save(callback) {
                callback('sme error')
            }
            static findOne(arg, callback) {
                callback(null, new FakePerm())
            }
        }
        const perm: any = FakePerm
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'delete permission with error on save'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        class FakePerm {
            remove(callback) {
                callback('sme error')
            }
            static findOne(arg, callback) {
                callback(null, new FakePerm())
            }
        }
        const perm: any = FakePerm
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .delete(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'put permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .put(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, admin: true, write: true }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'patch permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, admin: true, write: true }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'put permission with error on find'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFake', permissionSchema)
        perm.findOne = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .put(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'patch permission without any perm'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({}))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'patch permission with error on find'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFake', permissionSchema)
        perm.findOne = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .patch(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
    @test 'delete permission'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.permission
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .delete(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(200)
                        done()
                    })
                })
        })
    }
    @test 'delete permission with error on find'(done) {
        const r = Router()
        r.use((req: any, res, next) => {
            req.user = { _id: RestApiPathTest.id }
            next()
        })
        const hasAdminPermission = (req, id, callback) => {
            callback(null, true)
        }
        let objectTest = new RestApiPath(r, RestApiPathPermissionRootTest.route, RestApiPathPermissionRootTest.model, { hasAdminPermission })
        const perm: any = RestApiPathPermissionRootTest.connection.model('permFake', permissionSchema)
        perm.findOne = (doc, callback) => {
            callback('some error')
        }
        objectTest.setEndPoints([], perm)
        const app = express()
        app.use('/', objectTest.router)
        const server = app.listen(3003, () => {
            chai.request(server)
                .delete(`/test/${RestApiPathPermissionRootTest.id}/permission/user/${RestApiPathPermissionRootTest.id}`)
                .send(JSON.stringify({ read: true, user: RestApiPathPermissionRootTest.id }))
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(500)
                        done()
                    })
                })
        })
    }
}