import { suite, test } from "mocha-typescript";

import { ApiRouter } from '../src/router'
import * as express from 'express'
import mongoose = require("mongoose");
import bodyParser = require("body-parser");
import { Model, Connection } from "mongoose";
import { Server } from "http";
import { UserRequest, PermissionEnum, PermissionChecks } from "../src/definitions/model";
import { IUser } from "../src/models/userSchema";
import { EventEmitter } from "events";
let chai = require("chai");

const userSchema = new mongoose.Schema({
    roles: [mongoose.Schema.Types.ObjectId]
})
const CUSTOMER = 'Customer'
const PROVIDER = 'Provider'
@suite
class RouterTest {
    public static customerRef
    public static connection: Connection
    public static server: any
    public static server2: any
    public static customer: Model<any>
    public static provider: Model<any>

    public static before(done) {
        const app = express()
        app.use(bodyParser.json())
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_router";
        RouterTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
        const customerSchema = new mongoose.Schema({
            name: String,
            number: Number,
            boolean: Boolean,
            date: Date,
            objectid: mongoose.Schema.Types.ObjectId
        })
        const providerSchema = new mongoose.Schema({
            ref: { type: mongoose.Schema.Types.ObjectId, ref: CUSTOMER }
        })
        const hasAddPerm = (req, callback) => {
            callback(null, true)
        }
        const hasPerm = (req, doc, callback) => {
            callback(null, true)
        }
        RouterTest.customer = RouterTest.connection.model(CUSTOMER, customerSchema);
        RouterTest.provider = RouterTest.connection.model(PROVIDER, providerSchema);

        const router = ApiRouter()
        router.setGlobalRoute('/')
        router.setModel(`/${PROVIDER}`, RouterTest.provider, { hasAdminPermission: hasPerm, hasEditPermission: hasPerm, hasAddPermission: hasAddPerm })
        router.setModel(`/${CUSTOMER}`, RouterTest.customer, { hasAdminPermission: hasPerm, hasEditPermission: hasPerm, hasAddPermission: hasAddPerm, name: 'name' })
        app.use('/', router)
        app.get('/tree', router.publishUiTree())
        RouterTest.server = app
        let chaiHttp = require('chai-http');
        chai.use(chaiHttp)
        chai.should();

        const app2 = express()
        const router2 = ApiRouter({ isMongo4: true })
        router2.setGlobalRoute('/mongo4')
        router2.setModel(`/${PROVIDER}`, RouterTest.provider)
        router2.setModel(`/${CUSTOMER}`, RouterTest.customer, { name: 'name' })
        app2.use('/', router2)
        app2.get('/tree', router2.publishUiTree())
        RouterTest.server2 = app2
        done()
    }
    public static after(done) {
        RouterTest.customer.remove((error) => {
            if (error) return done(error)
            RouterTest.provider.remove((error) => {
                if (error) return done(error)
                RouterTest.connection.close((error) => {
                    if (error) return done(error)
                    done(error)
                })
            })
        })
    }
    @test("should get all customer objects")
    public getAllCustomerObjects(done) {
        chai.request(RouterTest.server)
            .get(`/${CUSTOMER}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200)
                res.body.total_pages.should.be.eql(0)
                res.body.count.should.be.eql(0)
                res.body.page.should.be.eql(1)
                res.body.results.should.be.a('array')
                res.body.results.length.should.be.eql(0)
                done()
            })
    }
    @test("should get all Provider objects")
    public getAllProviderObjects(done) {
        chai.request(RouterTest.server)
            .get(`/${PROVIDER}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200)
                res.body.total_pages.should.be.eql(0)
                res.body.count.should.be.eql(0)
                res.body.page.should.be.eql(1)
                res.body.results.should.be.a('array')
                res.body.results.length.should.be.eql(0)
                done()
            })
    }

    @test("should get create a customer object")
    public postCustomer(done) {
        let customer = {
            name: 'Hector'
        }
        chai.request(RouterTest.server)
            .post(`/${CUSTOMER}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("find by id - should get get the created customer object")
    public getIdCustomer(done) {
        chai.request(RouterTest.server)
            .get(`/${CUSTOMER}/${RouterTest.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("find by name - should get get the created customer object")
    public getNameCustomer(done) {
        chai.request(RouterTest.server)
            .get(`/${CUSTOMER}/${RouterTest.customerRef.name}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("should update the created customer object")
    public updateCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 1
        }
        chai.request(RouterTest.server)
            .put(`/${CUSTOMER}/${RouterTest.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(1);
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("should update finded by name the created customer object")
    public updateByNameCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 2
        }
        chai.request(RouterTest.server)
            .put(`/${CUSTOMER}/${RouterTest.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(2);
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("should update a field the created customer object")
    public applyPatchCustomer(done) {
        let customer = {
            number: 3
        }
        chai.request(RouterTest.server)
            .patch(`/${CUSTOMER}/${RouterTest.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(3);
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("should update a field finded by name the created customer object")
    public applyPatchByNameCustomer(done) {
        let customer = {
            number: 4
        }
        chai.request(RouterTest.server)
            .patch(`/${CUSTOMER}/${RouterTest.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(4);
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("should delete the created customer object")
    public deleteCustomer(done) {
        chai.request(RouterTest.server)
            .delete(`/${CUSTOMER}/${RouterTest.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                RouterTest.customerRef = res.body
                done();
            });
    }
    @test("should get the tree")
    public getTree(done) {
        chai.request(RouterTest.server)
            .get('/tree')
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(2)
                done();
            });
    }
}
@suite
class RouterTestPermissions {
    public static customerRef
    public static connection: Connection
    public static server: any
    public static customer: Model<any>
    public static provider: Model<any>
    public static emm: EventEmitter & PermissionChecks
    public static user: IUser
    public static before(done) {
        const app = express()
        app.use(bodyParser.json())
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_router";
        RouterTestPermissions.connection = mongoose.createConnection(MONGODB_CONNECTION);
        const customerSchema = new mongoose.Schema({
            name: String,
            number: Number,
            boolean: Boolean,
            date: Date,
            objectid: mongoose.Schema.Types.ObjectId
        })
        const providerSchema = new mongoose.Schema({
            ref: { type: mongoose.Schema.Types.ObjectId, ref: CUSTOMER }
        })
        const User = RouterTestPermissions.connection.model<IUser>('User', userSchema)
        RouterTestPermissions.customer = RouterTestPermissions.connection.model(CUSTOMER, customerSchema);
        RouterTestPermissions.provider = RouterTestPermissions.connection.model(PROVIDER, providerSchema);

        const router = ApiRouter({ strict: true })
        RouterTestPermissions.user = new User()
        var adminId = null
        router.use((req: UserRequest, res, next) => {
            req.user = RouterTestPermissions.user
            req.user.roles = [adminId]
            next()
        })
        router.setConnection(RouterTestPermissions.connection)
        router.setGlobalRoute('/')
        RouterTestPermissions.emm = router.setModel(`/${PROVIDER}`, RouterTestPermissions.provider)
        router.setModel(`/${CUSTOMER}`, RouterTestPermissions.customer, { name: 'name' })
        app.use('/', router)
        app.get('/tree', router.publishUiTree())
        const RoleModel = router.roleModel()
        new RoleModel({
            name: 'admin', schemas: [{
                name: RouterTestPermissions.provider.modelName,
                permission: PermissionEnum.ADMIN
            }, {
                name: RouterTestPermissions.customer.modelName,
                permission: PermissionEnum.ADMIN
            }]
        }).save((err, doc) => {
            if (err) return done(err)
            adminId = doc._id
            let chaiHttp = require('chai-http');
            chai.use(chaiHttp)
            chai.should();
            RouterTestPermissions.server = app
            done()
        })
    }
    public static after(done) {
        RouterTestPermissions.customer.remove((error) => {
            if (error) return done(error)
            RouterTestPermissions.provider.remove((error) => {
                if (error) return done(error)
                RouterTestPermissions.connection.close((error) => {
                    if (error) return done(error)
                    done(error)
                })
            })
        })
    }
    @test("should get all customer objects")
    public getAllCustomerObjects(done) {
        chai.request(RouterTestPermissions.server)
            .get(`/${CUSTOMER}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200)
                res.body.total_pages.should.be.eql(0)
                res.body.count.should.be.eql(0)
                res.body.page.should.be.eql(1)
                res.body.results.should.be.a('array')
                res.body.results.length.should.be.eql(0)
                done()
            })
    }
    @test("should get all Provider objects")
    public getAllProviderObjects(done) {
        chai.request(RouterTestPermissions.server)
            .get(`/${PROVIDER}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200)
                res.body.total_pages.should.be.eql(0)
                res.body.count.should.be.eql(0)
                res.body.page.should.be.eql(1)
                res.body.results.should.be.a('array')
                res.body.results.length.should.be.eql(0)
                done()
            })
    }
    @test("should create a customer object")
    public postCustomer(done) {
        let customer = {
            name: 'Hector'
        }

        chai.request(RouterTestPermissions.server)
            .post(`/${CUSTOMER}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }

    @test("find by id - should get get the created customer object")
    public getIdCustomer(done) {
        chai.request(RouterTestPermissions.server)
            .get(`/${CUSTOMER}/${RouterTestPermissions.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("find by name - should get get the created customer object")
    public getNameCustomer(done) {
        chai.request(RouterTestPermissions.server)
            .get(`/${CUSTOMER}/${RouterTestPermissions.customerRef.name}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("should update the created customer object")
    public updateCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 1
        }
        chai.request(RouterTestPermissions.server)
            .put(`/${CUSTOMER}/${RouterTestPermissions.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissions.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(1);
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }
    @test("should update finded by name the created customer object")
    public updateByNameCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 2
        }
        chai.request(RouterTestPermissions.server)
            .put(`/${CUSTOMER}/${RouterTestPermissions.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissions.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(2);
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }
    @test("should update a field the created customer object")
    public applyPatchCustomer(done) {
        let customer = {
            number: 3
        }
        chai.request(RouterTestPermissions.server)
            .patch(`/${CUSTOMER}/${RouterTestPermissions.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissions.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(3);
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }
    @test("should update a field finded by name the created customer object")
    public applyPatchByNameCustomer(done) {
        let customer = {
            number: 4
        }
        chai.request(RouterTestPermissions.server)
            .patch(`/${CUSTOMER}/${RouterTestPermissions.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissions.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(4);
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }
    @test("should delete the created customer object")
    public deleteCustomer(done) {
        chai.request(RouterTestPermissions.server)
            .delete(`/${CUSTOMER}/${RouterTestPermissions.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissions.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                RouterTestPermissions.customerRef = res.body
                done();
            });
    }
    @test("should get the tree")
    public getTree(done) {
        chai.request(RouterTest.server)
            .get('/tree')
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(2)
                done();
            });
    }
}
@suite
class RouterTestPermissionsEndPoints {
    public static customerRef
    public static connection: Connection
    public static server: any
    public static customer: Model<any>
    public static provider: Model<any>

    public static before(done) {
        const app = express()
        app.use(bodyParser.json())
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_router";
        RouterTestPermissionsEndPoints.connection = mongoose.createConnection(MONGODB_CONNECTION);
        const customerSchema = new mongoose.Schema({
            name: String,
            number: Number,
            boolean: Boolean,
            date: Date,
            objectid: mongoose.Schema.Types.ObjectId
        })
        const providerSchema = new mongoose.Schema({
            ref: { type: mongoose.Schema.Types.ObjectId, ref: CUSTOMER }
        })
        const user = RouterTestPermissionsEndPoints.connection.model<IUser>('User', userSchema)
        RouterTestPermissionsEndPoints.customer = RouterTestPermissionsEndPoints.connection.model(CUSTOMER, customerSchema);
        RouterTestPermissionsEndPoints.provider = RouterTestPermissionsEndPoints.connection.model(PROVIDER, providerSchema);

        const router = ApiRouter({ strict: true })
        var idAdmin = null
        router.use((req: UserRequest, res, next) => {
            req.user = new user({ roles: [idAdmin] })
            next()
        })
        router.setConnection(RouterTestPermissionsEndPoints.connection)
        router.setGlobalRoute('/')
        const hasAdminPermission = (req, doc, callback) => {
            callback(null, true)
        }
        router.setModel(`/${PROVIDER}`, RouterTestPermissionsEndPoints.provider, { hasAdminPermission })
        router.setModel(`/${CUSTOMER}`, RouterTestPermissionsEndPoints.customer, { name: 'name', hasAdminPermission })

        app.use('/', router)
        app.get('/tree', router.publishUiTree())
        const RoleModel = router.roleModel()
        new RoleModel({
            name: 'admin', schemas: [{
                name: RouterTestPermissionsEndPoints.provider.modelName,
                permission: PermissionEnum.ADMIN
            }, {
                name: RouterTestPermissionsEndPoints.customer.modelName,
                permission: PermissionEnum.ADMIN
            }]
        }).save((err, doc) => {
            if (err) return done(err)
            idAdmin = doc._id
            RouterTestPermissionsEndPoints.server = app
            let chaiHttp = require('chai-http');
            chai.use(chaiHttp)
            chai.should();
            done()
        })
    }
    public static after(done) {
        RouterTestPermissionsEndPoints.customer.remove((error) => {
            if (error) return done(error)
            RouterTestPermissionsEndPoints.provider.remove((error) => {
                if (error) return done(error)
                RouterTestPermissionsEndPoints.connection.close((error) => {
                    if (error) return done(error)
                    done(error)
                })
            })
        })
    }
    @test("should get all customer objects")
    public getAllCustomerObjects(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .get(`/${CUSTOMER}`)
            .end((err, res) => {
                chai.request(RouterTestPermissionsEndPoints.server)
                    .get(`/${CUSTOMER}`)
                    .end((err, res) => {
                        if (err) return done(err)
                        res.should.have.status(200)
                        res.body.total_pages.should.be.eql(0)
                        res.body.count.should.be.eql(0)
                        res.body.page.should.be.eql(1)
                        res.body.results.should.be.a('array')
                        res.body.results.length.should.be.eql(0)
                        done()
                    })
            })
    }
    @test("should get all Provider objects")
    public getAllProviderObjects(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .get(`/${PROVIDER}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200)
                res.body.total_pages.should.be.eql(0)
                res.body.count.should.be.eql(0)
                res.body.page.should.be.eql(1)
                res.body.results.should.be.a('array')
                res.body.results.length.should.be.eql(0)
                done()
            })
    }

    @test("should get create a customer object")
    public postCustomer(done) {
        let customer = {
            name: 'Hector'
        }
        chai.request(RouterTestPermissionsEndPoints.server)
            .post(`/${CUSTOMER}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("find by id - should get get the created customer object")
    public getIdCustomer(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .get(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("find by name - should get get the created customer object")
    public getNameCustomer(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .get(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef.name}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                done();
            });
    }
    @test("should update the created customer object")
    public updateCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 1
        }
        chai.request(RouterTestPermissionsEndPoints.server)
            .put(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissionsEndPoints.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(1);
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("should update finded by name the created customer object")
    public updateByNameCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 2
        }
        chai.request(RouterTestPermissionsEndPoints.server)
            .put(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissionsEndPoints.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(2);
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("should update a field the created customer object")
    public applyPatchCustomer(done) {
        let customer = {
            number: 3
        }
        chai.request(RouterTestPermissionsEndPoints.server)
            .patch(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissionsEndPoints.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(3);
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("should update a field finded by name the created customer object")
    public applyPatchByNameCustomer(done) {
        let customer = {
            number: 4
        }
        chai.request(RouterTestPermissionsEndPoints.server)
            .patch(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissionsEndPoints.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(4);
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("should delete the created customer object")
    public deleteCustomer(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .delete(`/${CUSTOMER}/${RouterTestPermissionsEndPoints.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RouterTestPermissionsEndPoints.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                RouterTestPermissionsEndPoints.customerRef = res.body
                done();
            });
    }
    @test("should get the tree")
    public getTree(done) {
        chai.request(RouterTestPermissionsEndPoints.server)
            .get('/tree')
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('array');
                res.body.length.should.be.eql(2)
                done();
            });
    }
}