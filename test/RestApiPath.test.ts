import { suite, test } from "mocha-typescript";

var mock = require('mock-require')
import express = require('express')
import { Router } from 'express';
import RestApiPath from '../src/models/RestApiPath'
import { Connection, Model, Query, Schema } from "mongoose";
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
    public static before(done) {
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_restapipath";
        RestApiPathTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
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
        RestApiPathTest.connection.close((error) => {
            if (error) return done(error)
            done(error)
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
        objectTest.setEndPoints([])
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
    @test "get all objects"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([])
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
        const getPermissionStep = (callback) => {
            callback(null, { string: 'string' })
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
        objectTest1.setEndPoints([])
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
    @test "get all objects with sort"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([])
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
    @test "get all objects handle error"(done) {
        mock('../src/models/query', './query.error.mock')
        const RestApiPath = mock.reRequire('../src/models/RestApiPath').default
        mock.stop('../src/models/query')
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([])
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
    @test "get an object by id"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([])
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
    @test "get an object by id with filter"(done) {
        const getPermissionStep = (callback) => {
            callback(null, { string: 'string2' })
        }
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { getPermissionStep })
        objectTest1.setEndPoints([])
        const app1 = express()
        app1.use('/', objectTest1.router)
        const server = app1.listen(3001, () => {
            chai.request(server)
                .get(`${RestApiPathTest.route}/${RestApiPathTest.id}`)
                .send('')
                .end((err, res) => {
                    server.close((err) => {
                        res.should.have.status(404)
                        done()
                    })
                })
        })
    }
    @test "get an object by id that not exist"(done) {
        let objectTest1 = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, {})
        objectTest1.setEndPoints([])
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
        objectTest1.getItem = (conditions, callback): Query<any> => {
            callback('no passed')
            return null
        }
        objectTest1.setEndPoints([])
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
        objectTest1.setEndPoints([])
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
        objectTest1.setEndPoints([])
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
        objectTest.setEndPoints([])
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
            objectTest.setEndPoints([])
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

        objectTest.getItem = (conditions, callback): Query<any> => {
            callback('no passed')
            return null
        }

        objectTest.setEndPoints([])
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
        objectTest2.setEndPoints([])
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
        objectTest2.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
            objectTest.getItem = (conditions, callback) => {
                object.save = (callback) => callback('some error')
                return callback(null, object)
            }
            objectTest.setEndPoints([])
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

        objectTest.getItem = (conditions, callback): Query<any> => {
            callback('no passed')
            return null
        }

        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.getItem = (conditions, callback) => {
            RestApiPathTest.model.findById(RestApiPathTest.id, (err, res) => {
                if (err) return callback(err)
                res.save = (callback) => callback('some error')
                return callback(null, res)
            })
        }
        objectTest.setEndPoints([])
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

        objectTest.getItem = (conditions, callback): Query<any> => {
            callback('no passed')
            return null
        }

        objectTest.setEndPoints([])
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
    @test("check hasDeletePermission works")
    public hasDeletePermission(done) {
        const hasDeletePermission = (req, doc, callback) => {
            callback(null, false)
        }
        let objectTest = new RestApiPath(Router(), RestApiPathTest.route, RestApiPathTest.model, { hasDeletePermission })
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.setEndPoints([])
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
        objectTest.model.deleteOne = (conditions, callback): Query<any> => {
            callback('no passed')
            return null
        }
        objectTest.setEndPoints([])
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
}