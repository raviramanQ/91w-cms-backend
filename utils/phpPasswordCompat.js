const crypto = require('crypto');

// PHP-compatible password encryption/decryption
// This matches the PHP OpenSSL AES-256-CBC encryption used in the legacy system

const ENCRYPTION_KEY = process.env.PHP_ENCRYPTION_KEY || '91wheels@2020';
const ENCRYPTION_IV = process.env.PHP_ENCRYPTION_IV || '9@1w#h$e%e^l&s*(';

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

function encryptPassword(password) {
  try {
    const key = padKey(ENCRYPTION_KEY);
    const iv = padIV(ENCRYPTION_IV);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(password, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

function decryptPassword(encryptedPassword) {
  try {
    const key = padKey(ENCRYPTION_KEY);
    const iv = padIV(ENCRYPTION_IV);
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedPassword, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
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
