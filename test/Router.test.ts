import { suite, test } from "mocha-typescript";

import { ApiRouter } from '../src/router'
import * as express from 'express'
import mongoose = require("mongoose");
import bodyParser = require("body-parser");
import { Model, Connection } from "mongoose";
import { Server } from "http";
let chai = require("chai");

const CUSTOMER = 'Customer'
const PROVIDER = 'Provider'
@suite
class RestApiPathTest {
    public static customerRef
    public static connection: Connection
    public static server: Server
    public static customer: Model<any>
    public static provider: Model<any>

    public static before(done) {
        const app = express()
        app.use(bodyParser.json())
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_router";
        RestApiPathTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
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
        RestApiPathTest.customer = RestApiPathTest.connection.model(CUSTOMER, customerSchema);
        RestApiPathTest.provider = RestApiPathTest.connection.model(PROVIDER, providerSchema);

        const router = ApiRouter({strict: true})
        router.setGlobalRoute('/')
        router.setModel(`/${PROVIDER}`, RestApiPathTest.provider)
        router.setModel(`/${CUSTOMER}`, RestApiPathTest.customer, { name: 'name' })
        app.use('/', router)
        app.get('/tree', router.publishUiTree())
        RestApiPathTest.server = app.listen(3000, (error: Error) => {
            let chaiHttp = require('chai-http');
            chai.use(chaiHttp)
            chai.should();
            done(error)
        })
    }
    public static after(done) {
        RestApiPathTest.customer.remove((error) => {
            if (error) return done(error)
            RestApiPathTest.provider.remove((error) => {
                if (error) return done(error)
                RestApiPathTest.connection.close((error) => {
                    if (error) return done(error)
                    done(error)
                })
            })
        })
    }
    @test("should get all customer objects")
    public getAllCustomerObjects(done) {
        chai.request(RestApiPathTest.server)
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
        chai.request(RestApiPathTest.server)
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
        chai.request(RestApiPathTest.server)
            .post(`/${CUSTOMER}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.should.have.property('_id');
                res.body.should.have.property('name').eql('Hector');
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("find by id - should get get the created customer object")
    public getIdCustomer(done) {
        chai.request(RestApiPathTest.server)
            .get(`/${CUSTOMER}/${RestApiPathTest.customerRef._id}`)
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
        chai.request(RestApiPathTest.server)
            .get(`/${CUSTOMER}/${RestApiPathTest.customerRef.name}`)
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
        chai.request(RestApiPathTest.server)
            .put(`/${CUSTOMER}/${RestApiPathTest.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RestApiPathTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(1);
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("should update finded by name the created customer object")
    public updateByNameCustomer(done) {
        let customer = {
            name: 'Hector',
            number: 2
        }
        chai.request(RestApiPathTest.server)
            .put(`/${CUSTOMER}/${RestApiPathTest.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RestApiPathTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(2);
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("should update a field the created customer object")
    public applyPatchCustomer(done) {
        let customer = {
            number: 3
        }
        chai.request(RestApiPathTest.server)
            .patch(`/${CUSTOMER}/${RestApiPathTest.customerRef._id}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RestApiPathTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(3);
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("should update a field finded by name the created customer object")
    public applyPatchByNameCustomer(done) {
        let customer = {
            number: 4
        }
        chai.request(RestApiPathTest.server)
            .patch(`/${CUSTOMER}/${RestApiPathTest.customerRef.name}`)
            .send(customer)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RestApiPathTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                res.body.should.have.property('number').eql(4);
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("should delete the created customer object")
    public deleteCustomer(done) {
        chai.request(RestApiPathTest.server)
            .delete(`/${CUSTOMER}/${RestApiPathTest.customerRef._id}`)
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('_id').eql(RestApiPathTest.customerRef._id);
                res.body.should.have.property('name').eql('Hector');
                RestApiPathTest.customerRef = res.body
                done();
            });
    }
    @test("should get the tree")
    public getTree(done) {
        chai.request(RestApiPathTest.server)
            .get('/tree')
            .end((err, res) => {
                if (err) return done(err)
                res.should.have.status(200);
                res.body.should.be.a('object');
                Object.keys(res.body).length.should.be.eql(2)
                done();
            });
    }
}