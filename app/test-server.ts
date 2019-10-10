import express = require('express');
import bodyParser = require('body-parser');
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs'

const app: express.Application = express();

app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

const RSA_KEY = fs.readFileSync('key.pem');

interface User {
    name: string;
    email: string;
    gender: string;
    age: number;
    about: string;
    interests: string[];

    [key: string]: any;
}

interface EmailPass {
    email: string;
    password: string;
}

const users: User[] = [{
    name: 'Vitaliy',
    about: 'llfdlewf',
    email: 'lol@gmail.com',
    gender: 'M',
    age: 19,
    interests: ['kek'],
    password: '123456'
}];

export function findUser(info: EmailPass): User | null {
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
    const credentials: EmailPass = req.body.loginInfo;
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