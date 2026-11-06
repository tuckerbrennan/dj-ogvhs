import test from 'node:test';import assert from 'node:assert/strict';
import {paymentOptions,validatedPaymentUrl} from '../src/tip-options.mjs';
test('unconfigured payment methods stay disconnected',()=>{
 assert.ok(paymentOptions({}).every(x=>!x.url&&!x.recipient));
});
test('payment links reject HTTP, spoofed hosts, and embedded credentials',()=>{
 for(const url of ['http://venmo.com/u/a','https://venmo.com.evil.example/u/a','https://evil.example@venmo.com/u/a'])assert.equal(validatedPaymentUrl(url,['venmo.com']),null);
});
test('PayPal email is preserved without guessing a PayPal.Me handle',()=>{
 const option=paymentOptions({paypalUrl:'https://www.paypal.com/myaccount/transfer/send',paypalRecipient:'ogvhstape@gmail.com'}).find(x=>x.label==='PayPal');
 assert.equal(option.recipient,'ogvhstape@gmail.com');assert.ok(!option.url.includes('paypal.me'));
});
