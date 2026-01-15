const crypto = require('crypto');

const PASS_KEY = '$91$Wheels$Ind$';
const INIT_VECTOR = '$^&%#9871050169#';
const ENC_TYPE = 'aes-256-cbc';
const PASS_PAD = 16;

function padKey(key) {
  const paddedKey = Buffer.alloc(32);
  Buffer.from(key, 'utf8').copy(paddedKey);
  return paddedKey;
}

function padIV(iv) {
  const paddedIV = Buffer.alloc(16);
  Buffer.from(iv, 'utf8').copy(paddedIV);
  return paddedIV;
}

function pkcs7Pad(data, blockSize) {
  const dataBuffer = Buffer.from(data, 'utf8');
  const padding = blockSize - (dataBuffer.length % blockSize);
  const paddingBuffer = Buffer.alloc(padding, padding);
  
  console.log('Input:', data);
  console.log('Data length:', dataBuffer.length);
  console.log('Padding:', padding);
  console.log('Padded data:', Buffer.concat([dataBuffer, paddingBuffer]));
  
  return Buffer.concat([dataBuffer, paddingBuffer]);
}

function encryptPassword(password) {
  const key = padKey(PASS_KEY);
  const iv = padIV(INIT_VECTOR);
  
  console.log('\nKey:', key);
  console.log('IV:', iv);
  
  const paddedData = pkcs7Pad(password, PASS_PAD);
  
  const cipher = crypto.createCipheriv(ENC_TYPE, key, iv);
  // DO NOT disable auto padding - PHP adds additional padding
  
  const encryptedBuffer = Buffer.concat([
    cipher.update(paddedData),
    cipher.final()
  ]);
  
  const result = encryptedBuffer.toString('base64');
  console.log('\nEncrypted:', result);
  console.log('Expected:  mFOcvd3EbGMBHLzXPGTFP/hEWONz1Ult+oUr1CsdCnE=');
  console.log('Match:', result === 'mFOcvd3EbGMBHLzXPGTFP/hEWONz1Ult+oUr1CsdCnE=');
  
  return result;
}

// Test
encryptPassword('password');
