import express from 'express';

export default class Server {
	public app: express.Application;
	public port: number = 3000;

	constructor(port?:number) {
        if(port) {
            this.port = port;
        }
		this.app = express();
	}

	start(callback: any) {
		this.app.listen(this.port, callback);
	}
}
