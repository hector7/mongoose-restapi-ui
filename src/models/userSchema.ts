import { Schema, Document } from "mongoose";
import { ROLE_MODEL } from "../definitions/model";
export type IUser = {
    super_admin?: boolean,
    roles: Schema.Types.ObjectId[]
} & Document
const roleSchema = new Schema({
    super_admin: Boolean,
    roles: { type: Schema.Types.ObjectId, ref: ROLE_MODEL }
})
export default roleSchema