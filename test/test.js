const SmartHome = require('../src');

describe('Smart home', () => {
  describe('throws on', () => {
    test('exceed device power', () => {
      expect(() => {
        // Мощность устройства превышает максимальную
        const sh = new SmartHome({
          devices: [{id: '1a', power: 2100, duration: 1}],
          rates: [{value: 1.5, from: 0, to: 7}],
          maxPower: 2000
        });
      }).toThrow(/^ERR-1.*$/);
    });

    test('exceed power', () => {
      expect(() => {
        // Суммарная мощность превышает максимальную
        const sh = new SmartHome({
          devices: [
            {id: '1a', power: 20, duration: 24},
            {id: '1b', power: 20, duration: 24},
          ],
          rates: [{value: 1.5, from: 0, to: 7}],
          maxPower: 30
        });
      }).toThrow(/^ERR-4.*$/);
    });

    test('duration exceeds day', () => {
      expect(() => {
        // Продолжительность работы 25 часов
        const sh = new SmartHome({
          devices: [{id: '1a', power: 100, duration: 25}],
          rates: [{value: 1.5, from: 0, to: 7}],
          maxPower: 2000
        });
      }).toThrow(/^ERR-2.*$/);
    });

    test('duration exceeds day', () => {
      expect(() => {
        // Продолжительность работы превышает продолжитльность режима работы
        const sh = new SmartHome({
          devices: [{id: '1a', power: 100, duration: 15, mode: 'night'}],
          rates: [{value: 1.5, from: 0, to: 7}],
          maxPower: 2000
        });
      }).toThrow(/^ERR-3.*$/);
    });
  });

  describe('on init', () => {
    test('set rates', () => {
      const sh = new SmartHome({
        devices: [{id: '1a', power: 20, duration: 1}],
        rates: [{value: 1.5, from: 0, to: 7}],
        maxPower: 2000
      });

      expect(sh.rates[0].hours.length).toEqual(7);
      expect(sh.rates[0].value).toEqual(1.5);
    });

    test('sorts devices', () => {
      const sh = new SmartHome({
        devices: [
          {id: '1a', power: 20, duration: 2},
          {id: '1b', power: 30, duration: 2},
        ],
        rates: [{value: 1.5, from: 0, to: 7}],
        maxPower: 200
      });

      expect(sh.devices[0].power).toEqual(30);
    });
  });

  test('get device', () => {
    const sh = new SmartHome({
      devices: [
        {id: '1a', power: 20, duration: 2},
        {id: '1b', power: 30, duration: 2},
      ],
      rates: [{value: 1.5, from: 0, to: 7}],
      maxPower: 200
    });
    const device = sh.getDevice('1a');

    expect(typeof device).toEqual('object');
    expect(device.power).toEqual(20);
    expect(device.duration).toEqual(2);
  });

  test('get device', () => {
    const sh = new SmartHome({
      devices: [
        {id: '1a', power: 20, duration: 2},
        {id: '1b', power: 190, duration: 2},
      ],
      rates: [{value: 1.5, from: 0, to: 7}],
      maxPower: 200
    });
    sh.result.schedule[0].push('1b');
    const isPowerEnough = sh.isPowerEnough(0, '1a');

    expect(isPowerEnough).toBe(false);
  });

  test('calculates schedule', () => {
    const sh = new SmartHome({
      devices: [
        {id: '1a', power: 200, duration: 5},
        {id: '1b', power: 1500, duration: 2},
      ],
      rates: [
        {value: 1.5, from: 11, to: 17},
        {value: 3, from: 17, to: 11}
      ],
      maxPower: 2000
    });
    const result = sh.getSchedule();

    expect(result.schedule[11].includes('1b')).toBe(true);
    expect(result.schedule[15].includes('1a')).toBe(true);
    expect(result.consumedEnergy.devices['1b']).toEqual(1500 * 2 * 1.5 / 1000);
    expect(result.consumedEnergy.devices['1a']).toEqual(200 * 5 * 1.5 / 1000);
    expect(result.consumedEnergy.value).toEqual(6);
  });
});
