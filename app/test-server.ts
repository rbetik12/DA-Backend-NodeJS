import express = require('express');
import bodyParser = require('body-parser');
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';
import {User} from './common/models/user.interface';
import {Credentials} from './common/models/credentials.interface';


const app: express.Application = express();
app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

const RSA_KEY = fs.readFileSync('key.pem');

const http = require('http').Server(app);
const io = require('socket.io')(http);
const mongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/readr";

mongoClient.connect(url, (err: any, db: any) => {
    if (err) throw err;
    console.log("Database connected!");
    db.close();
  });

const users: User[] = [{
    name: 'Vitaliy',
    about: 'Very interestin young man. Love to love and be loved',
    email: 'lol@gmail.com',
    gender: 'M',
    age: 19,
    interests: ['kek'],
    password: '123456'
}];


const documents: any = {};

io.on("connection", (socket: any) => {
    let previousId: any;
    const safeJoin = (currentId: any) => {
        socket.leave(previousId);
        socket.join(currentId);
        previousId = currentId;
    };

    socket.on("getDoc", (docId: any) => {
        safeJoin(docId);
        socket.emit("document", documents[docId]);
    });

    socket.on("addDoc", (doc: any) => {
        documents[doc.id] = doc;
        safeJoin(doc.id);
        io.emit("documents", Object.keys(documents));
        socket.emit("document", doc);
    });

    socket.on("editDoc", (doc: any) => {
        documents[doc.id] = doc;
        socket.to(doc.id).emit("document", doc);
    });

    io.emit("documents", Object.keys(documents));
});

http.listen(5000);


export function findUser(info: Credentials): User | null {
    for (let user of users) {
        console.log(user.email, ' ', info.email);
        console.log(user.password, ' ', info.password);
        if (user.email === info.email && user.password === info.password) {
            return user;
        }
    }
    return null;
}

export function register(req: any, res: any) {
    const user: User = req.body.userInfo;
    console.table(user);
    users.push(user);
    res.status(200).json({status: 'fine'});
}

export function login(req: any, res: any) {
    const credentials: Credentials = req.body.loginInfo;
    console.table(credentials);
    const h = 2;
    if (findUser(credentials)) {
        const jwtToken = jwt.sign({email: credentials.email}, RSA_KEY, {
            algorithm: 'RS256',
            expiresIn: '2 hours',
            subject: credentials.email,
        });
        const currentTime = new Date();
        res.status(200).json({
            emailToken: jwtToken,
            expiresIn: currentTime.setTime(currentTime.getTime() + (h*60*60*1000))
        });
    }
    else {
        res.status(404).end();
    }
}

app.route('/api/register').post(register);

app.route('/api/login').post(login);

app.listen(4000, () => {
    console.log("Server launched");
    console.table(users[0]);
})