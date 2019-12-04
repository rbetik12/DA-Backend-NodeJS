export interface MessageModel {
    _id: string;
    userID: number;
    sender: string;
    text: string;
    latitude: number;
    longitude: number;
    coefficient?: number;
}