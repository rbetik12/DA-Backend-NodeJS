import { ObjectID } from "mongodb";

export interface Photo {
    user_id: ObjectID,
    data: string
}