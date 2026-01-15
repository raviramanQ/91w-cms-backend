const crypto = require('crypto');

// PHP-compatible password encryption/decryption
// This matches the PHP OpenSSL AES-256-CBC encryption used in the legacy system
// From PHP: /Users/apple/Developer/91w/settings/defines.php

const PASS_KEY = '$91$Wheels$Ind$';
const INIT_VECTOR = '$^&%#9871050169#';
const ENC_TYPE = 'aes-256-cbc';
const PASS_PAD = 16;

// Pad key and IV to match PHP's behavior
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

// PKCS7 padding functions to match PHP
// PHP: $length = $size - strlen($data) % $size;
// PHP: return $data . str_repeat(chr($length), $length);
function pkcs7Pad(data, blockSize) {
  const dataBuffer = Buffer.from(data, 'utf8');
  const padding = blockSize - (dataBuffer.length % blockSize);
  const paddingBuffer = Buffer.alloc(padding, padding);
  return Buffer.concat([dataBuffer, paddingBuffer]);
}

function pkcs7Unpad(data) {
  const padding = data[data.length - 1];
  return data.slice(0, data.length - padding);
}

function encryptPassword(password) {
  try {
    const key = padKey(PASS_KEY);
    const iv = padIV(INIT_VECTOR);
    
    // Apply PKCS7 padding manually (returns Buffer)
    const paddedData = pkcs7Pad(password, PASS_PAD);
    
    const cipher = crypto.createCipheriv(ENC_TYPE, key, iv);
    // DO NOT disable auto padding - PHP adds additional padding even after manual padding
    // This matches PHP's behavior where openssl_encrypt adds padding to already-padded data
    
    // Encrypt and concatenate buffers, then convert to base64
    const encryptedBuffer = Buffer.concat([
      cipher.update(paddedData),
      cipher.final()
    ]);
    
    return encryptedBuffer.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

function decryptPassword(encryptedPassword) {
  try {
    const key = padKey(PASS_KEY);
    const iv = padIV(INIT_VECTOR);
    
    const decipher = crypto.createDecipheriv(ENC_TYPE, key, iv);
    // DO NOT disable auto padding - let cipher remove the outer padding layer
    
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedPassword, 'base64'),
      decipher.final()
    ]);
    
    // Remove the manual PKCS7 padding we added (inner layer)
    const unpaddedBuffer = pkcs7Unpad(decryptedBuffer);
    return unpaddedBuffer.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}

function verifyPassword(plainPassword, encryptedPassword) {
  try {
    const decrypted = decryptPassword(encryptedPassword);
    return plainPassword === decrypted;
  } catch (error) {
    return false;
  }
}

module.exports = {
  encryptPassword,
  decryptPassword,
  verifyPassword
};
