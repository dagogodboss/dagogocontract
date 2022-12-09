"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.contractInstance = exports.signer = exports.provider = void 0;
/* eslint-disable node/no-unpublished-import */
/* eslint-disable node/no-missing-import */
/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable node/no-extraneous-import */
var ethers_1 = require("ethers");
var goerli_json_1 = require("../deployments/goerli.json");
var index_1 = require("./../test/config/index");
var privateKey = process.env.PRIVATE_KEY ||
    "efe4371ae999faa253d8353103e20840ed92126fb1616dfa86fbd073861c060f";
var rocket = goerli_json_1["default"].rocket;
var provider = function () {
    return new ethers_1["default"].providers.InfuraProvider("goerli");
};
exports.provider = provider;
var signer = function () {
    return new ethers_1["default"].Wallet(privateKey, (0, exports.provider)());
};
exports.signer = signer;
var contractInstance = function (address, abi) {
    return new ethers_1["default"].Contract(address, abi, (0, exports.signer)());
};
exports.contractInstance = contractInstance;
var createPoolDTO = index_1.poolData;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var rocketInstance, transaction, transactionReceipt, event;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                rocketInstance = (0, exports.contractInstance)(rocket.address, rocket.abi);
                return [4 /*yield*/, rocketInstance.createPool(createPoolDTO)];
            case 1:
                transaction = _b.sent();
                return [4 /*yield*/, transaction.wait(2)];
            case 2:
                transactionReceipt = _b.sent();
                console.log(transactionReceipt);
                event = transactionReceipt === null || transactionReceipt === void 0 ? void 0 : transactionReceipt.events.filter(function (event) { return event === "CreatedPool"; });
                return [2 /*return*/, (_a = event.args) === null || _a === void 0 ? void 0 : _a.poolId];
        }
    });
}); })();
