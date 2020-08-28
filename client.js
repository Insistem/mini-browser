/*
在原来的基础上增加 解析HTML的功能
*/

const net = require('net');
const parse = require('./parse.js')

class Request {
    // method, url = host + post + path 
    // body k/v
    // headers
    constructor(options) {
        this.method = options.method || "GET"
        this.host = options.host
        this.port = options.port || 80
        this.path = options.path || "/"
        this.body = options.body || {}
        this.headers = options.headers || {}
        if (!this.headers['Content-Type']) {
            this.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        }
        // 根据Content-Type 转化body
        if (this.headers['Content-Type'] === 'application/json') {
            this.bodyText = JSON.stringify(this.body)
        } else if (this.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&')
        }
        this.headers['Content-Length'] = this.bodyText.length
    }
    toString () {
        return `${this.method} ${this.path} HTTP/1.1\r\nHOST: ${this.host}\r\n${Object.keys(this.headers).map(key => `${key}:${this.headers[key]}`).join('\r\n')}\r\n\r\n${this.bodyText}`
    }
    send (connection) {
        let parser = new ResponseParser()
        return new Promise((resolve, reject) => {
            if (connection) {
                connection.write(this.toString())
            } else {
                connection = net.createConnection({
                    host: this.host,
                    port: this.port,
                }, () => {
                    connection.write(this.toString())
                })
            }
            connection.on('data', function (data) {
                parser.receive(data.toString())
                if (parser.isFinished) {
                    resolve(parser.response)
                }
                connection.end()
            })
            connection.on('end', () => {
                console.log('disconnected from server');
            });
            connection.on('error', function (err) {
                reject(err)
                connection.end()
            })
        })
    }
}

class Response {

}

class ResponseParser {
    constructor() {
        // 状态机
        this.WAITING_STATUS_LINE = 0 // STATUS LINE
        this.WAITING_STATUS_LINE_END = 1 // STATUS LINE结束
        this.WAITING_HEADER_NAME = 2 // headers 的name
        this.WAITING_HEADER_SPACE = 3 // headers 的name后面的空格
        this.WAITING_HEADER_VALUE = 4 // headers 的key
        this.WAITING_HEADER_LINE_END = 5 // headers 的行内结束
        this.WAITING_HEADER_BLOCK_END = 6 // headers 的末尾结束
        this.WAITING_BODY = 7 // body 

        this.current = this.WAITING_STATUS_LINE
        this.statusLine = ''
        this.headers = {}
        this.headerName = ''
        this.headerValue = ''
        this.bodyParser = ''
    }

    get isFinished () {
        return this.bodyParser && this.bodyParser.isFinished
    }

    get response () {
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/)
        return {
            statusCode: RegExp.$1,
            statusTex: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }

    receive (string) {
        for (let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i))
        }
    }
    receiveChar (char) {
        // 处理headers
        if (this.current === this.WAITING_STATUS_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_STATUS_LINE_END
            } else {
                this.statusLine += char
            }
        }
        else if (this.current === this.WAITING_STATUS_LINE_END) {
            if (char === '\n')
                this.current = this.WAITING_HEADER_NAME
        }

        else if (this.current === this.WAITING_HEADER_NAME) {
            if (char === ':') {
                this.current = this.WAITING_HEADER_SPACE
            } else if (char === '\r') {
                this.current = this.WAITING_HEADER_BLOCK_END
            } else {
                this.headerName += char
            }
        }

        else if (this.current === this.WAITING_HEADER_SPACE) {
            if (char === ' ')
                this.current = this.WAITING_HEADER_VALUE
        }

        else if (this.current === this.WAITING_HEADER_VALUE) {
            if (char === '\r') {
                this.current = this.WAITING_HEADER_LINE_END
                this.headers[this.headerName] = this.headerValue
                this.headerName = ""
                this.headerValue = ""
            } else {
                this.headerValue += char
            }
        }
        else if (this.current === this.WAITING_HEADER_LINE_END) {
            if (char === '\n')
                this.current = this.WAITING_HEADER_NAME
        }

        else if (this.current === this.WAITING_HEADER_BLOCK_END) {
            if (char === '\n') {
                this.current = this.WAITING_BODY
            }
            if (this.headers['Transfer-Encoding'] === 'chunked') {
                this.bodyParser = new TrunkedBodyParser()
            }
        }

        else if (this.current === this.WAITING_BODY) {
            // 处理body
            this.bodyParser.receiveChar(char)
        }

    }
}
/*
body返回的结构
"4\r\nokay\r\n0\r\n\r\n"
*/
class TrunkedBodyParser {
    constructor() {
        this.WAITING_LENGTH = 0
        this.WAITING_LENGTH_LINE_END = 1
        this.READING_TRUNK = 2
        this.WAITING_NEW_LINE = 3
        this.WAITING_NEW_LINE_END = 4
        this.length = 0
        this.content = []
        this.isFinished = false

        this.current = this.WAITING_LENGTH
    }
    receiveChar (char) {
        if (this.current === this.WAITING_LENGTH) {
            if (char === '\r') {
                if (this.length === 0) {
                    this.isFinished = true
                } else {
                    this.current = this.WAITING_LENGTH_LINE_END
                }
            } else {
                // TODO:这是干啥的
                // 第一个值表示的是body的length
                // this.length *= 10
                // this.length += char.charCodeAt(0) - '0'.charCodeAt(0)
                // 修改为：
                this.length *= 16
                this.length += parseInt(char, 16)
            }
        }

        else if (this.current === this.WAITING_LENGTH_LINE_END) {
            if (char === '\n') {
                this.current = this.READING_TRUNK
            }
        }

        else if (this.current === this.READING_TRUNK) {
            this.content.push(char)
            this.length--
            if (this.length === 0) {
                this.current = this.WAITING_NEW_LINE
            }
        }

        else if (this.current === this.WAITING_NEW_LINE) {
            if (char === '\r') {
                this.current = this.WAITING_NEW_LINE_END
            }
        }

        else if (this.current === this.WAITING_NEW_LINE_END) {
            if (char === '\n') {
                this.current = this.WAITING_LENGTH
            }
        }
    }
}
void async function () {
    let request = new Request({
        method: "POST",
        path: "/",
        host: "127.0.0.1",
        port: 8088,
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "mpy"
        }
    })

    let res = await request.send()
    let resBody = parse.parseHTML(res.body)
    console.log('res', res)
}()

