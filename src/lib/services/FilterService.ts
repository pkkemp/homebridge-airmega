/* eslint-disable max-len */
import { Config } from '../Config';
import { HAP } from '../HAP';
import { Service } from '../interfaces/HAP';
import { AbstractService } from './AbstractService';
import { Logger } from '../Logger';

export class FilterService extends AbstractService {
  register(): void {
    const mainFilterService = this.getOrCreateMainFilterService();
    const preFilterService = this.getOrCreatePreFilterService();

    mainFilterService.getCharacteristic(HAP.Characteristic.FilterChangeIndication)
      .on('get', this.getMainFilterChangeIndication.bind(this));

    mainFilterService.getCharacteristic(HAP.Characteristic.FilterLifeLevel)
      .on('get', this.getMainFilterLifeLevel.bind(this));

    preFilterService.getCharacteristic(HAP.Characteristic.FilterChangeIndication)
      .on('get', this.getPreFilterChangeIndication.bind(this));

    preFilterService.getCharacteristic(HAP.Characteristic.FilterLifeLevel)
      .on('get', this.getPreFilterLifeLevel.bind(this));

    // need to use linked services to get Apple's Home app to show the filter status
    const purifierService = this.accessory.getService(HAP.Service.AirPurifier);
    purifierService.addLinkedService(mainFilterService);
    purifierService.addLinkedService(preFilterService);
  }

  getOrCreateMainFilterService(): Service {
    let filterService = this.accessory.getServiceByUUIDAndSubType(HAP.Service.FilterMaintenance, Config.Filters.MAIN_FILTER_HAP_SUBTYPE);

    if (!filterService) {
      filterService = this.accessory.addService(HAP.Service.FilterMaintenance, this.purifier.name + ' Max2-filter', Config.Filters.MAIN_FILTER_HAP_SUBTYPE);
    }

    return filterService;
  }

  getOrCreatePreFilterService(): Service {
    let filterService = this.accessory.getServiceByUUIDAndSubType(HAP.Service.FilterMaintenance, Config.Filters.PRE_FILTER_HAP_SUBTYPE);

    if (!filterService) {
      filterService = this.accessory.addService(HAP.Service.FilterMaintenance, this.purifier.name +' Pre-filter', Config.Filters.PRE_FILTER_HAP_SUBTYPE);
    }

    return filterService;
  }

  async getMainFilterChangeIndication(callback): Promise<void> {
    try {
      const indication = await this.getChangeIndicationForFilter(Config.Filters.MAIN_FILTER_CODE);
      callback(null, indication);
    } catch(e) {
      callback(e);
    }
  }

  async getPreFilterChangeIndication(callback) {
    try {
      const indication = await this.getChangeIndicationForFilter(Config.Filters.PRE_FILTER_CODE);
      callback(null, indication);
    } catch(e) {
      callback(e);
    }
  }

  async getMainFilterLifeLevel(callback): Promise<void> {
    try {
      const lifeLevel = await this.getLifeLevelForFilter(Config.Filters.MAIN_FILTER_CODE);
      callback(null, lifeLevel);
    } catch(e) {
      callback(e);
    }
  }

  async getPreFilterLifeLevel(callback): Promise<void> {
    try {
      const lifeLevel = await this.getLifeLevelForFilter(Config.Filters.PRE_FILTER_CODE);
      callback(null, lifeLevel);
    } catch(e) {
      callback(e);
    }
  }

  async getChangeIndicationForFilter(code: string): Promise<any> {
    try {
      const status = await this.purifier.waitForFilterStatusUpdate();
      const statusForFilter = status.find(filter => filter.code === code);
      let indication;

      if (statusForFilter.lifeLevel <= 20) {
        indication = HAP.Characteristic.FilterChangeIndication.CHANGE_FILTER;
      } else {
        indication = HAP.Characteristic.FilterChangeIndication.FILTER_OK;
      }

      return indication;
    } catch(e) {
      Logger.error(`Unable to get filter change indication for ${code}`, e);
      throw e;
    }
  }

  async getLifeLevelForFilter(code: string): Promise<number> {
    try {
      const status = await this.purifier.waitForFilterStatusUpdate();
      const statusForFilter = status.find(filter => filter.code === code);

      return statusForFilter.lifeLevel;
    } catch(e) {
      Logger.error(`Unable to get filter life level for ${code}`, e);
      throw e;
    }
  }
}