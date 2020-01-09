import { QueryCtrl } from 'app/plugins/sdk';
import './css/query-editor.css!'

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  constructor($scope, $injector) {
    super($scope, $injector);
    this.scope = $scope;

    // Critical attribute needed in datasource spec (self tests)
    this.target.target = 'unused attribute';
    // All source type available
    this.target.sourceTypeTab = ['Device', 'Interface'];
    // Attribute type correspond to source type (Device or Interface)
    this.target.type = this.target.type;
    // All boolean needed to display correct box (default is Device)
    this.target.displayDeviceBox = this.target.displayDeviceBox;
    this.target.displayInterfaceBox = this.target.displayInterfaceBox;
    this.target.displayDifferenciationAndCurveBox = this.target.displayDifferenciationAndCurveBox;
    // Attribute deviceID is the id of device selected 
    this.target.deviceID = this.target.deviceID;
    // Attribute interfaceID is the id of the interface selected
    this.target.interfaceID = this.target.interfaceID;
    // Attribute metricClassID is the id of metric-class selected
    this.target.metricClassID = this.target.metricClassID;
    // Attribute metricID is the id of metric selected
    this.target.metricID = this.target.metricID || "";
    // Attribute differenciation is the differenciation of the metric selected (can be empty) 
    this.target.differenciation = this.target.differenciation;
    // Depending of target.differenciation, multiple curve can be avalaible to print, user selects one
    this.target.selectedCurve = this.target.selectedCurve;
    // Attribute containing lettre from Grafana row
    this.target.DOMextractedRefID = this.target.DOMextractedRefID;
    this.target.rollupType = this.target.rollupType;
    // this.target.rollupTab = ["disabled", "aggregateavgrollup", "aggregateminrollup", "aggregatemaxrollup", "aggregatesumrollup", "durationweightedrollup"];
    this.target.rollupTab = []
    this.target.listOfCurves
    // Alias used or not by user
    this.target.customAlias;
    // Timeshift used or not by user
    this.target.timeshift;
  }


  // These methods are called by boxes in query.editor.html and call methods from datasource.js

  // Retreive all devices avalaible
  getDeviceOptions(query) {
    return this.datasource.netimGetAllDevices(query || '');
  }

  // Retreive all interfaces (from device in argument) avalaible
  getInterfaceOptions() {
    return this.datasource.netimGetInterfacesFromDevice(this.target.deviceID);
  }

  // Retreive all metric classes avalaible
  getMetricClassOptions() {
    return this.datasource.netimGetAllMetricClasses();
  }

  // Retreive all metrics avalaible for metric class in argument
  getMetricOptions() {
    return this.datasource.netimGetMetricsFromClass(this.target.metricClassID);
  }

  // Retreive all differenciation options avalaible and send current grafana query-row letter
  getDifferenciationOptions() {
    return this.datasource.netimGetDifferenciationList(this.target.refId || '');
  }

  // Retreives all curves returned by NetIM and send current grafana query-row letter
  getAvailableCurveOptions() {
    this.target.listOfCurves = this.datasource.netimGetCuvesList(this.target.refId)
    return this.target.listOfCurves;
  }

  // Retreive all rollup algorythm avalaible and send current grafana query-row letter
  getRollupOptions() {
    return this.datasource.metricFindRollupQuery(this.target.refId);
  }

  // When changing source type, bind False to all boolean (all boxes disapear)
  disableAllBoxBool() {
    this.target.displayDeviceBox = false;
    this.target.displayInterfaceBox = false;
    this.target.displayDifferenciationAndCurveBox = false;
  }

  // If source type 'Device' is selected, only his boolean is set to True
  toggleDeviceBool() {
    this.disableAllBoxBool();
    this.target.displayDeviceBox = true;
  }

  // If source type 'Interface' is selected, only his boolean is set to True
  toggleInterfaceBool() {
    this.disableAllBoxBool();
    this.target.displayInterfaceBox = true;
  }

  // Method triggered by source type selection (a new query is being made), cleaning all up
  runningSelect() {
    // Reset attributes
    this.target.deviceID = "";
    this.target.interfaceID = "";
    this.target.metricClassID = "";
    this.target.metricID = "";
    this.target.differenciation = "";
    this.target.selectedCurve = "";
    this.target.displayDifferenciationAndCurveBox = false;
    // Toggling boolean depending of selected case of combobox 'Source type' (this will display concerned boxes):
    if (this.target.type == "Device") {
      this.toggleDeviceBool();
    }
    if (this.target.type == "Interface") {
      this.toggleInterfaceBool();
    }
  }

  // Method triggering /query in datasource.js
  onChangeInternal() {
    // this.target.displayDifferenciationAndCurveBox = this.datasource.needToggle(this.target.refId)
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
    console.log("\nREFRESHED\n");
  }

}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';

