import { suite, test } from "mocha-typescript";
import { Connection, Model, Schema } from "mongoose";
import permissionSchema, { IPermission } from "../src/models/permissionSchema";
import roleSchema, { IRole } from "../src/models/roleSchema";
import PermissionClass from "../src/models/PermissionClass";
import { IUser } from "../src/models/userSchema";
import { PermissionEnum } from "../src/definitions/model";
import { doesNotReject } from "assert";
const mongoose = require("mongoose");

@suite('Permission Class test')
class PermissionClassTest {
    static permission: Model<IPermission>
    static role: Model<IRole>
    static model: Model<any>
    static user: Model<IUser>
    static connection: Connection
    public static before() {
        global.Promise = require("q").Promise;

        //use q library for mongoose promise
        mongoose.Promise = global.Promise;

        const MONGODB_CONNECTION: string = "mongodb://localhost:27017/test_mongoose_api_ui_permission_class";
        PermissionClassTest.connection = mongoose.createConnection(MONGODB_CONNECTION);
        PermissionClassTest.permission = PermissionClassTest.connection.model('perm', permissionSchema)
        PermissionClassTest.role = PermissionClassTest.connection.model('rol', roleSchema)
        PermissionClassTest.user = PermissionClassTest.connection.model<IUser>('user', new mongoose.Schema({
            roles: [{ type: Schema.Types.ObjectId, ref: 'rol' }]
        }))
        PermissionClassTest.model = PermissionClassTest.connection.model('test1', new mongoose.Schema({
            string: String
        }))
    }
    public static after(done) {
        PermissionClassTest.connection.dropDatabase((err) => {
            PermissionClassTest.connection.close((error) => {
                if (err) return done(err)
                if (error) return done(error)
                done(error)
            })
        })
    }
    @test '_getReadObjects function handle mongoose error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const permissionModel: any = {
            find: (filter, projection, cb) => {
                cb(new Error('some error'))
            }
        }
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, PermissionClassTest.role, { getFilterByPermissions })
        const req: any = { user }
        perm.getReadQuery(req, (err, query) => {
            err.message.should.be.eql('some error')
            done()
        })
    }
    @test '_getReadObjects function 0 items'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions })
        const req: any = { user }
        perm.getReadQuery(req, (err, query) => {
            if (err) return done(err)
            query.should.be.eql({ _id: { $exists: false } })
            done()
        })
    }
    @test '_getReadObjects function 1 item'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object, permission: PermissionEnum.READ }).save((err, doc) => {
            if (err) return done(err)
            const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions })
            const req: any = { user }
            perm.getReadQuery(req, (err, query) => {
                if (err) return done(err)
                query.should.be.eql({ _id: { $in: [doc.object] } })
                done()
            })
        })
    }
    @test '_getReadObjects function +1 item'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const object2 = new PermissionClassTest.model({ string: 'string' })
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object, permission: PermissionEnum.READ }).save((err, doc) => {
            if (err) return done(err)
            new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: object2, permission: PermissionEnum.READ }).save((err, doc2) => {
                if (err) return done(err)
                const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions })
                const req: any = { user }
                perm.getReadQuery(req, (err, query) => {
                    if (err) return done(err)
                    query.should.be.eql({ _id: { $in: [doc.object, doc2.object] } })
                    done()
                })
            })
        })
    }
    @test '_getUserRoles function with no role function'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions: (a, cb) => cb(null, null) }).getReadQuery(req, (err, query) => {
            if (err) return done(err)
            if (query) return done(query)
            done()
        })
    }
    @test '_getUserRoles function with no roles setted'(done) {
        const user = new PermissionClassTest.user({})
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
            .getReadQuery(req, (err, query) => {
                if (err) return done(err)
                if (query) return done(query)
                done()
            })
    }
    @test '_getUserRoles function with no roles'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
            .getReadQuery(req, (err, query) => {
                if (err) return done(err)
                if (query) return done(query)
                done()
            })
    }
    @test '_getUserRoles function with 1 roles'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
                .getReadQuery(req, (err, query) => {
                    if (err) return done(err)
                    if (query) return done(query)
                    done()
                })
        })
    }
    @test '_getUserRoles function with +1 roles'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.READ }] }).save((err, role2) => {
                if (err) return done(err)
                user.roles = [role._id, role2._id]
                new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
                    .getReadQuery(req, (err, query) => {
                        if (err) return done(err)
                        if (query) return done(query)
                        done()
                    })
            })
        })
    }
    @test '_getUserRoles function with +1 roles descendant'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.ADMIN }] }).save((err, role2) => {
                if (err) return done(err)
                user.roles = [role._id, role2._id]
                new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
                    .getReadQuery(req, (err, query) => {
                        if (err) return done(err)
                        if (query) return done(query)
                        done()
                    })
            })
        })
    }
    @test '_getMaxPermissionByDoc function with no permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const obj = new PermissionClassTest.model({})
        new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions: (a, cb) => cb(null, null) })
            .hasReadPermission(req, obj, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed.')
            })
    }
    @test '_getMaxPermissionByDoc function with 0 docs'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const obj = new PermissionClassTest.model({})
        new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
            .hasReadPermission(req, obj, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done('test failed')
                done()
            })
    }
    @test '_getMaxPermissionByDoc function with some docs'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const obj = new PermissionClassTest.model({})
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: obj, permission: PermissionEnum.READ }).save((err, doc2) => {
            if (err) return done(err)
            new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
                .hasReadPermission(req, obj, (err, hasReadPermission) => {
                    if (err) return done(err)
                    if (hasReadPermission) return done()
                    return done('test failed')
                })
        })
    }
    @test 'getReadQuery function handle error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.getReadQuery(req, (err, query) => {
            err.message.should.be.eql('some error')
            done()
        })
    }
    @test 'getReadQuery with a role > READ'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions: (a, cb) => cb(null, null) })
                .getReadQuery(req, (err, query) => {
                    if (err) return done(err)
                    if (query) return done(query)
                    done()
                })
        })
    }
    @test 'getReadQuery handle getFilterByPermissionserror'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(new Error('some error'), null) })
            .getReadQuery(req, (err, query) => {
                err.message.should.be.equal('some error')
                if (query) return done('test failed')
                done()
            })
    }
    @test 'getReadQuery handle _getReadObjects error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const permissionModel: any = {
            find: (filter, projection, cb) => {
                cb(new Error('some error'))
            }
        }
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, PermissionClassTest.role, { getFilterByPermissions })
        const req: any = { user }
        perm.getReadQuery(req, (err, query) => {
            err.message.should.be.eql('some error')
            done()
        })
    }
    @test 'getReadQuery with no permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions: (a, cb) => cb(null, { r: 'the query' }) })
            .getReadQuery(req, (err, query) => {
                if (err) return done(err)
                query.r.should.be.eql('the query')
                done()
            })
    }
    @test 'getReadQuery with 0 permission objects'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, {r:'the query'}) })
            .getReadQuery(req, (err, query) => {
                if (err) return done(err)
                query.r.should.be.eql('the query')
                done()
            })
    }
    @test 'getReadQuery with 0 permission objects and no query'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
            .getReadQuery(req, (err, query) => {
                if (err) return done(err)
                query.should.be.eql({ _id: { $exists: false } })
                done()
            })
    }
    @test 'getReadQuery with +1 ermission objects and no query'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const object2 = new PermissionClassTest.model({ string: 'string' })
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object, permission: PermissionEnum.READ }).save((err, doc) => {
            if (err) return done(err)
            new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: object2, permission: PermissionEnum.READ }).save((err, doc2) => {
                if (err) return done(err)
                const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions })
                perm.getReadQuery(req, (err, query) => {
                    if (err) return done(err)
                    query.should.be.eql({ _id: { $in: [doc.object, doc2.object] } })
                    done()
                })
            })
        })
    }
    @test 'getReadQuery with +1 ermission objects and with query'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, 'the query')
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const object2 = new PermissionClassTest.model({ string: 'string' })
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object, permission: PermissionEnum.READ }).save((err, doc) => {
            if (err) return done(err)
            new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: object2, permission: PermissionEnum.READ }).save((err, doc2) => {
                if (err) return done(err)
                const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions })
                perm.getReadQuery(req, (err, query) => {
                    if (err) return done(err)
                    query.should.be.eql({ $and: ['the query', { _id: { $in: [doc.object, doc2.object] } }] })
                    done()
                })
            })
        })
    }
    @test '_hasReadPermissionByOptions handle error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(new Error('some error'))
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions })
        perm.hasReadPermission(req, object, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasReadPermissionByOptions no query no role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { getFilterByPermissions })
        perm.hasReadPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasReadPermissionByOptions no query with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, null)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions })
        perm.hasReadPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasReadPermissionByOptions handle query error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const getFilterByPermissions = (user, cb) => {
            cb(null, 'some query')
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const model: any = {
            findOne: (filter, cb) => cb(new Error('some error'))
        }
        const req: any = { user }
        const perm = new PermissionClass(model, null, PermissionClassTest.role, { getFilterByPermissions })
        perm.hasReadPermission(req, object, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasReadPermissionByOptions with query and no doc'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, { _id: { $exists: true } })
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions })
        perm.hasReadPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasReadPermissionByOptions with query and doc'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const getFilterByPermissions = (user, cb) => {
            cb(null, { _id: { $exists: true } })
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        object.save((err) => {
            if (err) return done(err)
            const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, { getFilterByPermissions })
            perm.hasReadPermission(req, object, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasReadPermission handle role error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.hasReadPermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasReadPermission handle getMaxPermissionsError error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const permissionModel: any = {
            findOne: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, null, {})
        perm.hasReadPermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasReadPermission with 1 role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasReadPermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasReadPermission with 1 permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        doc.save((err, doc) => {
            if (err) return done(err)
            new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user: user._id, object: doc._id, permission: PermissionEnum.READ }).save((err) => {
                if (err) return done(err)
                perm.hasReadPermission(req, doc, (err, hasReadPermission) => {
                    if (err) return done(err)
                    if (hasReadPermission) return done()
                    done('test failed')
                })
            })
        })
    }
    @test 'hasReadPermission with 0 permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, { getFilterByPermissions: (a, cb) => cb(null, null) })
        perm.hasReadPermission(req, doc, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasAddPermissionByOptions handle error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasAddPermission = (user, cb) => {
            cb(new Error('some error'))
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasAddPermission })
        perm.hasAddPermission(req, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasAddPermissionByOptions response'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasAddPermission = (user, cb) => {
            cb(null, true)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasAddPermission })
        perm.hasAddPermission(req, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasAddPermissionByOptions without option and role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, {})
        perm.hasAddPermission(req, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasAddPermissionByOptions without option and with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, {})
        perm.hasAddPermission(req, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasAddPermission handle role error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.hasAddPermission(req, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasAddPermission with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.ADD }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasAddPermission(req, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasAddPermission without role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: 0 }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasAddPermission(req, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done('test failed')
                done()
            })
        })
    }
    @test '_hasUpdatePermissionByOptions handle error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasUpdatePermission = (user, doc, cb) => {
            cb(new Error('some error'))
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasUpdatePermission })
        perm.hasUpdatePermission(req, object, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasUpdatePermissionByOptions response'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasUpdatePermission = (user, doc, cb) => {
            cb(null, true)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasUpdatePermission })
        perm.hasUpdatePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasUpdatePermissionByOptions without option and role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, {})
        perm.hasUpdatePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasUpdatePermissionByOptions without option and with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, {})
        perm.hasUpdatePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasUpdatePermission handle role error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.hasUpdatePermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasUpdatePermission handle getMaxPermissionsError error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const permissionModel: any = {
            findOne: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, null, {})
        perm.hasUpdatePermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasUpdatePermission with permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: doc, permission: PermissionEnum.ADMIN }).save((err) => {
            if (err) return done(err)
            perm.hasUpdatePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasUpdatePermission with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.UPDATE }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasUpdatePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasUpdatePermission without role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: 0 }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasUpdatePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done('test failed')
                done()
            })
        })
    }
    @test '_hasDeletePermissionByOptions handle error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasDeletePermission = (user, doc, cb) => {
            cb(new Error('some error'))
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasDeletePermission })
        perm.hasDeletePermission(req, object, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasDeletePermissionByOptions response'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasDeletePermission = (user, doc, cb) => {
            cb(null, true)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasDeletePermission })
        perm.hasDeletePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasDeletePermissionByOptions without option and role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, {})
        perm.hasDeletePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasDeletePermissionByOptions without option and with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, {})
        perm.hasDeletePermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasDeletePermission handle role error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.hasDeletePermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasDeletePermission handle getMaxPermissionsError error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const permissionModel: any = {
            findOne: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, null, {})
        perm.hasDeletePermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasDeletePermission with permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: doc, permission: PermissionEnum.ADMIN }).save((err) => {
            if (err) return done(err)
            perm.hasDeletePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasDeletePermission with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.ADMIN }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasDeletePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasDeletePermission without role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: 0 }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasDeletePermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done('test failed')
                done()
            })
        })
    }
    @test '_hasAdminPermissionByOptions handle error'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasAdminPermission = (user, doc, cb) => {
            cb(new Error('some error'))
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasAdminPermission })
        perm.hasAdminPermission(req, object, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasAdminPermissionByOptions response'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const hasAdminPermission = (user, doc, cb) => {
            cb(null, true)
        }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, { hasAdminPermission })
        perm.hasAdminPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done()
            done('test failed')
        })
    }
    @test '_hasAdminPermissionByOptions without option and role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, null, {})
        perm.hasAdminPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test '_hasAdminPermissionByOptions without option and with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const object = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, null, PermissionClassTest.role, {})
        perm.hasAdminPermission(req, object, (err, hasReadPermission) => {
            if (err) return done(err)
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasAdminPermission handle role error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const roleModel: any = {
            find: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const req: any = { user }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, roleModel, {})
        perm.hasAdminPermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasAdminPermission handle getMaxPermissionsError error'(done) {
        const role = new PermissionClassTest.role({})
        const user = new PermissionClassTest.user({ roles: [role] })
        const req: any = { user }
        const permissionModel: any = {
            findOne: (filter, cb) => {
                cb(new Error('some error'))
            }
        }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, permissionModel, null, {})
        perm.hasAdminPermission(req, doc, (err, hasReadPermission) => {
            err.message.should.be.eql('some error')
            if (hasReadPermission) return done('test failed')
            done()
        })
    }
    @test 'hasAdminPermission with permission'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const doc = new PermissionClassTest.model({ string: 'string' })
        const req: any = { user }
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.permission({ table: PermissionClassTest.model.modelName, user, object: doc, permission: PermissionEnum.ADMIN }).save((err) => {
            if (err) return done(err)
            perm.hasAdminPermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasAdminPermission with role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: PermissionEnum.ADMIN }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasAdminPermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done()
                done('test failed')
            })
        })
    }
    @test 'hasAdminPermission without role'(done) {
        const user = new PermissionClassTest.user({ roles: [] })
        const req: any = { user }
        const doc = new PermissionClassTest.model({ string: 'string' })
        const perm = new PermissionClass(PermissionClassTest.model, PermissionClassTest.permission, PermissionClassTest.role, {})
        new PermissionClassTest.role({ name: 's', schemas: [{ name: PermissionClassTest.model.modelName, permission: 0 }] }).save((err, role) => {
            if (err) return done(err)
            user.roles = [role._id]
            perm.hasAdminPermission(req, doc, (err, hasReadPermission) => {
                if (err) return done(err)
                if (hasReadPermission) return done('test failed')
                done()
            })
        })
    }
}
