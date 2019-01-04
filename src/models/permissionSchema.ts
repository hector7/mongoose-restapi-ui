import { Schema, Document } from "mongoose";
import { PermissionEnum, ROLE_MODEL } from "../definitions/model";
export type IPermission = {
    table: string,
    object: any,
    user: any,
    permission: PermissionEnum
} & Document
const permissionSchema = new Schema({
    table: { type: String, required: true },
    object: { type: Schema.Types.ObjectId, required: true },
    user: Schema.Types.ObjectId,
    permission: Number
})

export default permissionSchema