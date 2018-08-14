const intersection = require('lodash.intersection');

/**
 *  Приводим сутки и режимы работы устройств к массивам часов
 * [0..23], [7..20], [21..23].concat([0..6])
 */
const DAY = 24;
const DAY_START = 7;
const DAY_END = 21;
const hours = [...Array(DAY).keys()];
const dayHours = hours.slice(DAY_START, DAY_END);
const nightHours = hours.slice();
nightHours.splice(DAY_START, dayHours.length);
const modeHours = {
  day: dayHours,
  night: nightHours
};

function SmartHome(input) {
  this.validate(input);
  // Сортируем устройства по убыванию мощности
  this.devices = input.devices.slice().sort((a, b) => b.power - a.power);
  // Приводим тарифы к нужному виду
  this.rates = this.setRates(input.rates.slice());
  this.maxPower = input.maxPower;
  this.result = {
    schedule: {},
    consumedEnergy: {
      value: 0,
      devices: {}
    }
  };
  [...Array(24).keys()].forEach(i => this.result.schedule[i] = []);
}

/**
 * Проверяет входные данные на корректность
 * @param {Object} input Входные данные
 */
SmartHome.prototype.validate = function(input) {
  let totalPower = 0;

  for (let device of input.devices) {
    if (device.power > input.maxPower) {
      throw new Error(`ERR-1: Мощность устройства ${device.name} превышает допустимую.`);
    }
    if (device.duration > DAY) {
      throw new Error(`ERR-2: Продолжительность работы устройства ${device.name} превышает допустимую.`);
    }
    if (device.mode && device.duration > modeHours[device.mode].length) {
      throw new Error(`ERR-3: Продожительность работы устройства ${device.name} превышает режим работы.`)
    }

    totalPower += (device.power * device.duration);
  }

  if (totalPower > input.maxPower * DAY) {
    throw new Error('ERR-4: Суммарная мощность устройств превышает допустимую.');
  }
};

/**
 * Приводит тарифы к виду { value, hours } где hours - массив часов активности тарифа
 * @param {Array} rates Массив с тарифами в исходном виде
 * @returns {Array} Массив объектов содержащих тарифную ставку и массив часов для этой ставки
 */
SmartHome.prototype.setRates = function(rates) {
  const formatedRates = [];
  const ratesWithHours = rates.map(rate => {
    const to = rate.from < rate.to ? rate.to : rate.to + 24;
    rate.hours = [];

    for (let i = rate.from; i < to; i++) {
      const hour = i < 24 ? i : i - 24;
      rate.hours.push(hour);
    }
    delete rate.from;
    delete rate.to;

    return {value: rate.value, hours: rate.hours};
  });

  ratesWithHours.forEach(rate => {
    const newRate = formatedRates.find(r => r.value === rate.value);

    if (newRate) {
      newRate.hours = newRate.hours.concat(rate.hours)
    } else {
      formatedRates.push(rate);
    }
  });

  return formatedRates;
}

/**
 * @param {String} id Идентификатор устройства
 * @returns {Object} Объект устройства
 */
SmartHome.prototype.getDevice = function(id) {
  return this.devices.find(device => device.id === id) || { power: 0 };
}

/**
 * @param {Number} hour Час из расписания
 * @param {Object} device Устройство
 * @returns {Boolean} Достаточно ли в указанный час мощности для включения указанного устройства
 */
SmartHome.prototype.isPowerEnough = function(hour, device) {
  let curPower = this.result.schedule[hour].reduce((a, b) => this.getDevice(a).power + this.getDevice(b).power, 0);

  return this.maxPower >= curPower + device.power;
}

/**
 * @param {Number} power Мощность устройства
 * @param {Number} value Тарифная ставка
 * @returns {Number} Потребление энергии за час с указанной тарифной ставкой в денежном эквиваленте
 */
SmartHome.prototype.getConsuming = function(power, value) {
  return power * value;
}

/**
 * @returns {String} JSON с результатом вычисления расписания работы умного дома
 */
SmartHome.prototype.getSchedule = function() {
  // Проходим по устройствам, начиная с самого мощного
  this.devices.forEach(device => {
    // Получаем значение тарифных ставок и сортируем по возрастанию
    const rateValues = this.rates.map(r => r.value).sort((a, b) => a - b);
    let deviceDuration = device.duration;
    let acceptableHours;

    this.result.consumedEnergy.devices[String(device.id)] = 0;

    // Проходим по тарифам, начиная с самого выгодного
    for (let value of rateValues) {
      // Получаем часы активности тарифа
      const rateHours = this.rates.find(r => r.value === value).hours;

      // Находим общие часы активности устройства и тарифа
      if (device.mode) {
        acceptableHours = intersection(
          modeHours[device.mode],
          rateHours
        );
      } else {
        acceptableHours = intersection(
          hours,
          rateHours
        );
      }

      if (!acceptableHours.length) {
        // Если общих часов нет, переходим к следующей тарифной ставке
        continue;
      } else {
        // В противном случае проходим циклом по часам
        for (let hour of acceptableHours) {
          // Если цикл работы устройства не закончился и мощности достаточно, добавляем устройство в расписание
          if (deviceDuration && this.isPowerEnough(hour, device)) {
            const consuming = this.getConsuming(device.power, value);

            this.result.schedule[hour].push(device.id);
            this.result.consumedEnergy.value += consuming;
            this.result.consumedEnergy.devices[device.id] += consuming;
            deviceDuration -= 1;
          }
        }
      }
    }
  });

  // Пересчёт на киловатты
  this.result.consumedEnergy.value /= 1000;
  for (let id in this.result.consumedEnergy.devices) {
    this.result.consumedEnergy.devices[id] /= 1000;
  }

  return this.result;
};

module.exports = SmartHome;
