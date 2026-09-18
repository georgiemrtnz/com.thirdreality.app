"use strict";

const { ZigBeeDevice } = require("homey-zigbeedriver");
const { CLUSTER } = require("zigbee-clusters");

class VibrationSensor extends ZigBeeDevice {
  /**
   * onInit is called when the device is initialized.
   */
  async onNodeInit({ zclNode }) {
    try {
      if (
        this.hasCapability("alarm_generic") ||
        !this.hasCapability("alarm_vibration")
      ) {
        this.removeCapability("alarm_generic");
        this.addCapability("alarm_vibration");
      }

      this.log("Vibration Sensor has been initialized");
      if (this.getClusterEndpoint(CLUSTER.IAS_ZONE)) {
        zclNode.endpoints[this.getClusterEndpoint(CLUSTER.IAS_ZONE)].clusters[
          CLUSTER.IAS_ZONE.NAME
        ].onZoneStatusChangeNotification = (payload) => {
          this.onIASZoneStatusChangeNotification(payload);
        };
      }
      if (this.getClusterEndpoint(CLUSTER.POWER_CONFIGURATION)) {
        const powerConfiguration = zclNode.endpoints[
          this.getClusterEndpoint(CLUSTER.POWER_CONFIGURATION)
        ].clusters[CLUSTER.POWER_CONFIGURATION.NAME];

        powerConfiguration.on(
          "attr.batteryPercentageRemaining",
          this.onBatteryPercentageRemainingAttributeReport.bind(this),
        );

        // Battery-powered sensors can remain quiet for long periods. If Homey
        // has no persisted battery reading, obtain one once after startup;
        // otherwise rely on normal attribute reports and avoid extra traffic.
        if (this.getCapabilityValue("measure_battery") === null) {
          await this.refreshBatteryValue(powerConfiguration);
        }
      }
    } catch (err) {
      this.log(err);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log("Vibration Sensor has been added");
  }

  onIASZoneStatusChangeNotification({
    zoneStatus,
    extendedStatus,
    zoneId,
    delay,
  }) {
    this.log(
      "IASZoneStatusChangeNotification received:",
      zoneStatus,
      extendedStatus,
      zoneId,
      delay,
    );
    this.log("zoneStatus", zoneStatus.alarm1);
    this.setCapabilityValue("alarm_vibration", zoneStatus.alarm1).catch(
      this.error,
    );
  }

  onBatteryPercentageRemainingAttributeReport(batteryPercentageRemaining) {
    const batteryThreshold = this.getSetting("batteryThreshold") || 20;
    this.log(
      "measure_battery | powerConfiguration - batteryPercentageRemaining (%): ",
      batteryPercentageRemaining / 2,
    );
    this.setCapabilityValue(
      "measure_battery",
      batteryPercentageRemaining / 2,
    ).catch(this.error);
    this.unsetWarning().catch(this.error);
  }

  async refreshBatteryValue(powerConfiguration) {
    try {
      const { batteryPercentageRemaining } = await powerConfiguration
        .readAttributes(["batteryPercentageRemaining"]);

      if (Number.isFinite(batteryPercentageRemaining)) {
        this.onBatteryPercentageRemainingAttributeReport(
          batteryPercentageRemaining,
        );
        return;
      }

      await this.setWarning(
        "Battery reading unavailable; wake this sensor or improve its Zigbee route.",
      );
    } catch (err) {
      // A sleeping end device may not respond immediately. Make the missing
      // state visible in Homey, then clear it as soon as a normal report
      // arrives.
      this.log("Unable to refresh vibration-sensor battery value", err);
      await this.setWarning(
        "Battery reading unavailable; wake this sensor or improve its Zigbee route.",
      ).catch(this.error);
    }
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log("Vibration Sensor settings where changed");
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log("Vibration Sensor was renamed");
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log("Vibration Sensor has been deleted");
  }
}

module.exports = VibrationSensor;
