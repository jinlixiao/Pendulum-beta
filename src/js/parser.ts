const addInvisibleDots = true;
//Parsing constants
const zerocode = '0'.charCodeAt(0);
const ninecode = '9'.charCodeAt(0);
const slashcode = '\\'.charCodeAt(0);
const dotcode = '.'.charCodeAt(0);
const isSymbol = (code = 0) => {
    return (code <= 63 && code >= 58) || (code <= 47 && code >= 33)
        || (code <= 126 && code >= 123) || (code <= 96 && code >= 91) || code === ' '.charCodeAt(0);
};
const acode = 'a'.charCodeAt(0);
const zcode = 'z'.charCodeAt(0);
const Acode = 'A'.charCodeAt(0);
const Zcode = 'Z'.charCodeAt(0);

/**
 * Check and returns the type of the given character
 * @param {string} c The character
 * @returns {string} type can be one of digit, symbol, letter or '.'
 */
function getCharType(c:string) {
    let code = c.charCodeAt(0);
    if (code <= ninecode && code >= zerocode)
        return "digit";
    else if (c === '.')
        return ".";
    else if (c===' ')
        return "space";
    else if ((code <= zcode && code >= acode) || (code <= Zcode && code >= Acode))
        return "letter";
    else
        return "symbol";
}

type MStruct = {[key:string]:MStruct | [string, string, number]};
// Item structure: [name, type, sub-clause count]
let macros:MStruct = {
    '{': ['{', 'openstruct', 0],
    '}': ['}', 'closestruct', 0],
    '(': ['(', 'openstruct', 0],
    ')': ['(', 'closestruct', 0],
    '$': ['$', 'closestruct', 0],
    '+': ['add', 'operator', 0],
    '-': ['sub', 'operator', 0],
    '*': ['mul', 'operator', 0],
    '/': ['div', 'operator', 0],
    '^': ['pow', 'operator', 0],
    '=': ['equal', 'operator', 0],
    '!': ['factorial', 'operator', 0],
    '\\': {
        ' ': ['space', 'structure', 0],
        'c': {'d': {'o': {'t': ['dot', 'operator', 0],
                }
            },
            'o': {
                's': ['cos', 'function', 1],
                't': ['cot', 'function', 1]
            },
        },
        'd': {
            'i': {
                'v': ['div', 'operator', 0]
            }
        },
        'f': {
            'r': {
                'a': {
                    'c': ['div', 'operator', 0]
                }
            }
        },
        /*
         *  Integration takes four subclauses, the first and second are the lower and upper bounds, the third is the integrand,
         *  and the last is the integration variable d$.
         */
        'i':{
            'n':{
                't': ['integrate', 'operator', 4]
            }
        },
        'l': {
            'n': ["ln", 'operator', 0],
            'e': {
                'f': {
                    't': {
                        '(': ['(', 'openstruct', 0],
                        '|': ['|', 'openstruct', 1],
                        '{': ['{', 'openstruct', 0],
                    }
                }
            }
        },
        'm': {
            'a': {
                't': {
                    'h': {
                        'b': {
                            'f':{
                                '{':{
                                    'd':{
                                        '}':['diff', 'closestruct', 1], //especially used for defining differential operator d
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        'p': {
            'i': ['pi', 'constant', 0],
            'r': {
                'o': {
                    'd': ['prod', 'operator', 2]
                }
            }
        },
        'r': {
            'i': {
                'g': {
                    'h': {
                        't': {
                            ')': [')', 'closestruct', 0],
                            '|': ['|', 'closestruct', 0],
                            '}': ['}', 'closestruct', 0],
                        }
                    }
                }
            }
        },
        's': {
            'i': {
                'n': ['sin', 'function', 1]
            },
            'u': {
                'm': ['sum', 'operator', 2]
            },
            'q': {
                'r': {
                    't': ['sqrt', 'function', 1]
                }
            }
        },
        't': {
            'a': {
                'n': ['tan', 'function', 1]
            }
        },
    }
};

class Token{
    //Possible types include: function, operator, openstruct, closestruct, #, $
    type: string = 'none';
    content: string;
    //Indices for the token in the list
    start: number=0;
    //One plus the index of the last character of this token in the tex string
    end: number=0;
    clauseCount = 0;
    subClauses: Token[][];
    parentClause: Token[];

    /**
     * Parses the content of the tex string starting at specified positions to
     * get this token's contents
     * @param start the position at which this token starts
     * @param tex the entire tex string from the input
     * @param previousType type of the previous token
     * @return parseConstant indicating if there are any errors in the syntax during parsing,
     *                       0: parse successfully terminated, 1: unrecognized character
     */
    readFrom(tex:string, start: number, previousType:string):number{
        this.start = start;
        let state = 'init';
        let macro:MStruct|Array<number|string> = macros;
        let i = start;
        let terminating = false;
        let dotCount = 0;
        while(!terminating){
            this.end = i;
            let char = tex[i];
            if(char == undefined)
                return 0;
            let cType = getCharType(char);
            switch(state){//Enter into the main clause of the state machine depending on the state
                case 'init':
                    switch(cType){
                        case 'digit':
                            state = 'number';
                            this.type = '#';
                            this.content = char;
                            break;
                        case '.':
                            state = 'number';
                            this.type = '#';
                            this.content = char;
                            dotCount = 1;
                            break;
                        case 'letter':
                            state = 'variable';
                            this.type ='$';
                            this.content = char;
                            break;
                        case 'symbol':
                            if((macro = macros[char])==undefined)return 1;
                            state = 'macro';
                            this.type = 'incompleteMacro';
                            if(macro instanceof Array){
                                this.content = <string>macro[0];
                                this.type = <string>macro[1];
                                this.clauseCount = <number> macro[2];
                            }
                            break;
                        case 'space':
                            this.type = 'structure';
                            this.content = 'space';
                            break;
                    }
                    break;

                case 'number':
                    switch (cType) {
                        case 'digit':
                            this.content += char;
                            break;
                        case '.':
                            if(dotCount==0){
                                this.content += char;
                                dotCount = 1;
                            }
                            else terminating = true;
                            break;
                        case 'letter': terminating = true;
                            break;
                        case 'symbol':
                        case 'space':
                            terminating = true;
                    }
                    break;
                case 'variable':
                    switch(cType){
                        case '.':
                        case 'digit':
                        case 'letter':
                            terminating = true;
                            break;
                        case 'symbol':
                        case 'space':
                            if(char == '_') state = 'var_';
                            else if(tex.substr(i, 6)=='\\left(') return this.parseClauses(tex, i, 1);
                            else terminating = true;
                    }
                    break;
                case 'var_':
                    switch (cType) {
                        case 'digit':
                        case 'letter':
                            this.content += char;
                            //queue for termination after one extra round (the next char will be ignored)
                            state = 'var_{}';
                            break;
                        case 'symbol':
                        case 'space':
                            if(char == '{') state = 'var_{';
                            else if(char != ' ') return 1;
                            break;
                        case 'dot': return 1;
                    }
                    break;
                case 'var_{':
                    if(char != '}') this.content += char;
                    else state = 'var_{}';
                    break;
                case 'var_{}':
                    if(tex.substr(i, 6)=='\\left(') return this.parseClauses(tex, i, 1);
                    else terminating = true;
                    break;
                case 'macro':
                    if(macro instanceof Array) {
                        terminating = true;
                        this.checkNegation(previousType);
                        return this.parseClauses(tex, i, this.clauseCount);
                    }else if((macro = macro[char])!=undefined){
                        if(macro instanceof Array) {
                            this.content = <string>macro[0];
                            this.type = <string>macro[1];
                            this.clauseCount = <number>macro[2];
                        }
                    }else return 1;
                    break;
                case 'space':
                    switch(cType){
                        case 'space':
                            break;
                        default:
                            terminating = true;
                    }
                    break;
                case 'terminating':
                    terminating = true;
            }
            i++;
        }
        return 0;
    }

    /**
     * Serves to parse the subclauses of a token given that it is
     * an operator permitting subclauses
     *
     * @return parseConstant indicating if there are any errors in the syntax during parsing,
     *                       0: parse successfully terminated, 1: unrecognized character
     */
    parseClauses(tex: string, start: number, clauseCount:number): number{
        if(clauseCount == 0){
            return;
        }else{
            this.subClauses = new Array(clauseCount);
        }
        let i = start;
        switch(this.content){
            case 'sum':
            case 'prod':
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                break;
            case 'integrate':
                //Parse lower bound
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                //Parse upper bound
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                //Parse integrand
                let parser = new Parser();
                i = parser.linParse(tex, i, this, new Structure('diff', this));
                this.subClauses[3] = [parser.tokenList.pop()];
                this.subClauses[2] = parser.tokenList;
                break;
            case 'diff':
                let token = new Token();
                token.readFrom(tex, start, 'diff');
                if(token.type!='$')
                    return 1;
                this.subClauses[0]=[token];
                i = token.end;
                break;
            case 'cos':
            case 'sin':
            case 'cot':
            case 'tan':
                if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 0);
                else {
                    this.subClauses[0] = [];
                    this.clauseCount = 0;
                }
                break;
        }
        if(this.type == '$'){
            if(tex.substr(i, 6)=='\\left('){
                let parser = new Parser();
                let openStruct = new Token();
                openStruct.type = 'openStruct';
                openStruct.content = '(';
                openStruct.start = start;
                openStruct.end = start+1;
                i = parser.linParse(tex, start+6, openStruct, new Structure(')', openStruct));
                parser.tokenList.pop();
                this.subClauses[0] = parser.tokenList;
                this.type = 'func$'
            }
        }
        this.end = i;
    }

    /**
     * Parse for a particular sub-clause beginning with '{' and ending with '}'
     * @param tex the entire tex string
     * @param start the beginning of the sub-clause, '{' included
     * @param clauseIndex the sub-clause that the parsed segment of string belongs to
     */
    parseSubClause(tex: string, start: number, clauseIndex:number):number{
        let end;
        if(tex.charAt(start)=='{'){
            let parser = new Parser();
            let openStruct = new Token();
            openStruct.type = 'openStruct';
            openStruct.content = '{';
            openStruct.start = start;
            openStruct.end = start+1;
            end = parser.linParse(tex, start+1, openStruct, new Structure('}', openStruct));
            parser.tokenList.pop();
            this.subClauses[clauseIndex] = parser.tokenList;
        } else {
            let token = new Token();
            token.readFrom(tex, start, 'openstruct');
            this.subClauses[clauseIndex]=[token];
            end = token.end;
        }
        return end;
    }

    /**
     * Called to check if '-' should be parsed to a
     * subtraction operator or a negation operator
     * @param previousType
     */
    checkNegation(previousType: string){
        if(this.content=='sub'){
            if(previousType==undefined||previousType=='operator'){
                this.content = 'neg';
            }
        }
    }
}

// Token.prototype.toString = function(){
//     return this.type+':'+this.content;
// }

class SymNode{
    children: SymNode[]=[];
    content: string|number;
    token: Token;
    type: string;
}

/**
 * Inside the formats are instructions for the matching of various structures. In the parse stack,
 * a close close parenthesis shall be inserted on account of each open parenthesis, and all closing structures
 * that match the top of the parse stack will cause a pop instruction, otherwise they throw errors.
 */
let formats:{[key:string]:string} = {
    '(':')',
    '{':'}',
    '$':'$'
}

//Class for items in the parse stack, representing structure typed tokens
class Structure{
    identifier: string;
    //The token that serves as the open structure corresponding to this (closing structure)
    //The start and end index inside destination can be particularly helpful when raising parsing errors
    destination: Token;
    constructor(identifier:string, destination: Token) {
        this.identifier = identifier;
        this.destination = destination;
    }
}

class Parser{

    toStatementTree(latex:string){
        console.log(latex);
        console.log("in to statement tree");
        try{
            this.linParse(latex+'$');
        }catch (e) {
            console.log(e);
        }
        console.log(this.tokenList);
        let statementTree = this.syParse(this.tokenList);
        console.log(statementTree);
        return statementTree;
    }

    /**
     * The token list of this holds the result of linParse
     */
    tokenList:Token[] = [];
    /**
     * Parse stack helps keeps track of parenthesis, at its bottom, it also holds an exit string that signals
     * the termination of the current parsing level, and returns to the previous level by exiting the linParse function.
     */
    parseStack:Structure[] = [];

    /**
     *
     * @param tex
     * @param start
     * @param previousToken
     * @param terminator The structure representation of the token that causes the current level of parsing to terminate.
     * '$' is the default terminator for the root level parsing.
     */
    linParse(tex: string, start:number = 0, previousToken = new Token(),
             terminator:Structure = new Structure('$', previousToken)): number{
        this.tokenList.length=0;
        this.parseStack.push(terminator);
        let i = start;
        while (this.parseStack.length!=0&&i<tex.length){
            let token = new Token();
            //Starts reading the tex string starting from index i,
            let parseConstant = token.readFrom(tex, i, previousToken.type);
            switch(parseConstant){
                case 1:
                    console.log(previousToken);
                    throw new SyntaxError('Unrecognized syntax at '+token.start+' on character '+tex[token.end]);
                default:
                    break;
            }
            if(addInvisibleDots){
                if((['closestruct', '$', '#'].indexOf(previousToken.type)!=-1)&&
                    (['$', 'function', '#'].indexOf(token.type)!=-1||token.content=='(')){
                    let invisDot = new Token();
                    invisDot.type = 'operator';
                    invisDot.start = invisDot.end = previousToken.end;
                    invisDot.content = 'invisdot';
                    this.tokenList.push(invisDot);
                }
            }
            this.tokenList.push(token);
            if(token.type == 'openstruct'){
                this.parseStack.push(new Structure(formats[token.content], token));
            }
            if(token.type == 'closestruct'){
                if(this.parseStack[this.parseStack.length-1].identifier==token.content){
                    this.parseStack.pop();
                }
                else throw new SyntaxError('Mismatched closures between '+
                                this.parseStack[0].destination.content+' and '+token.content);
            }
            previousToken = token;
            i = token.end;
        }
        return i;
    }

    /**
    /**
     * The core algorithm for parsing token list into statement trees, relies primarily
     * on shunting yard. Left/right associativity are differentiated for certain operators and functions.
     * @param tokenList the list of parsed tokens
     */
    syParse(tokenList: Token[]): SymNode{
        let shuntingYard:Token[] = [];
        let tray: SymNode[] = [];
        for(let token of tokenList){
            if(token.type == '$' ||token.type == '#'){
                let node = new SymNode();
                node.type = token.type;
                node.content = token.content;
                node.token = token;
                tray.push(node);
            }else if(token.type == 'function' ||token.type == 'operator'){
                while(shuntingYard.length!=0&&shuntingYard[shuntingYard.length-1].type!='openstruct'
                    &&this.compareAssociativity(shuntingYard[shuntingYard.length-1], token)) {
                    let operator = shuntingYard.pop();
                    let node = new SymNode();
                    node.type = operator.type;
                    node.content = operator.content;
                    node.token = operator;
                    let operandCount = this.operatorChart[operator.content][2];
                    for(let i = 0; i<operandCount; i++){
                        node.children[operandCount-i-1]=tray.pop();
                    }
                    tray.push(node);
                }
                shuntingYard.push(token);
            } else if(token.type == 'openstruct')
                shuntingYard.push(token);
            else if(token.type == 'closestruct'){
                let operator;
                while(shuntingYard.length!= 0 && formats[(operator=shuntingYard.pop()).content]!=token.content){
                    let node = new SymNode();
                    node.type = operator.type;
                    node.content = operator.content;
                    node.token = operator;
                    for(let i = 0; i<this.operatorChart[operator.content][2]; i++){
                        node.children[i] = tray.pop();
                    }
                    tray.push(node);
                }
            }
        }
        return tray[0];
    }

    /**
     * [left associativity, right associativity, parameter count]
     * @private
     */
    private operatorChart: {[key:string]:number[]}={
        'add': [1, 1, 2],
        'sub': [1, 1, 2],
        'mul': [3, 2, 2],
        'invisdot': [3, 2, 2],
        'div': [3, 2, 2],
        'pow': [4, 5, 2],
        'equal': [0, 0, 2],
        'tan': [1.5, 6, 1],
        'cot': [1.5, 6, 1],
        'sin': [1.5, 6, 1],
        'cos': [1.5, 6, 1],
        'factorial': [6, 5, 1],
        'neg':[1.5, 6, 1],
        'ln': [5, 6, 1]
    }
    /**
     * Returns true if opr1 has higher left associativity than opr2's
     * right associativity
     * @param opr1 left operator
     * @param opr2 right operator
     */
    compareAssociativity(opr1: Token, opr2: Token): boolean{
        return this.operatorChart[opr1.content][0]>=this.operatorChart[opr2.content][1];
    }
}

export {Parser, SymNode};