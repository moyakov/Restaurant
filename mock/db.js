const mysql = require('mysql2/promise');

jest.mock('mysql2/promise', () => {
  const mockPool = {
    query: jest.fn(),
  };
  return {
    createPool: jest.fn(() => mockPool)
  };
});

module.exports = mysql.createPool();