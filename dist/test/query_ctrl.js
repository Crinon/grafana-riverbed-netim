'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericDatasourceQueryCtrl = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdk = require('app/plugins/sdk');

require('./css/query-editor.css!');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var GenericDatasourceQueryCtrl = exports.GenericDatasourceQueryCtrl = function (_QueryCtrl) {
  _inherits(GenericDatasourceQueryCtrl, _QueryCtrl);

  function GenericDatasourceQueryCtrl($scope, $injector) {
    _classCallCheck(this, GenericDatasourceQueryCtrl);

    var _this = _possibleConstructorReturn(this, (GenericDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(GenericDatasourceQueryCtrl)).call(this, $scope, $injector));

    _this.scope = $scope;

    // Critical attribute needed in datasource spec (self tests)
    _this.target.target = 'unused attribute';
    // All source type available
    _this.target.sourceTypeTab = ['Device', 'Interface'];
    // Attribute type correspond to source type (Device or Interface)
    _this.target.type = _this.target.type;
    // All boolean needed to display correct box (default is Device)
    _this.target.displayDeviceBox = _this.target.displayDeviceBox;
    _this.target.displayInterfaceBox = _this.target.displayInterfaceBox;
    _this.target.displayDifferenciationAndCurveBox = _this.target.displayDifferenciationAndCurveBox;
    // Attribute deviceID is the id of device selected 
    _this.target.deviceID = _this.target.deviceID;
    // Attribute interfaceID is the id of the interface selected
    _this.target.interfaceID = _this.target.interfaceID;
    // Attribute metricClassID is the id of metric-class selected
    _this.target.metricClassID = _this.target.metricClassID;
    // Attribute metricID is the id of metric selected
    _this.target.metricID = _this.target.metricID || "";
    // Attribute differenciation is the differenciation of the metric selected (can be empty) 
    _this.target.differenciation = _this.target.differenciation;
    // Depending of target.differenciation, multiple curve can be avalaible to print, user selects one
    _this.target.selectedCurve = _this.target.selectedCurve;
    // Attribute containing lettre from Grafana row
    _this.target.DOMextractedRefID = _this.target.DOMextractedRefID;
    _this.target.rollupType = _this.target.rollupType;
    // this.target.rollupTab = ["disabled", "aggregateavgrollup", "aggregateminrollup", "aggregatemaxrollup", "aggregatesumrollup", "durationweightedrollup"];
    _this.target.rollupTab = [];
    _this.target.listOfCurves;
    // Alias used or not by user
    _this.target.customAlias;
    // Timeshift used or not by user
    _this.target.timeshift;
    return _this;
  }

  // These methods are called by boxes in query.editor.html and call methods from datasource.js

  // Retreive all devices avalaible


  _createClass(GenericDatasourceQueryCtrl, [{
    key: 'getDeviceOptions',
    value: function getDeviceOptions(query) {
      return this.datasource.netimGetAllDevices(query || '');
    }

    // Retreive all interfaces (from device in argument) avalaible

  }, {
    key: 'getInterfaceOptions',
    value: function getInterfaceOptions() {
      return this.datasource.netimGetInterfacesFromDevice(this.target.deviceID);
    }

    // Retreive all metric classes avalaible

  }, {
    key: 'getMetricClassOptions',
    value: function getMetricClassOptions() {
      return this.datasource.netimGetAllMetricClasses();
    }

    // Retreive all metrics avalaible for metric class in argument

  }, {
    key: 'getMetricOptions',
    value: function getMetricOptions() {
      return this.datasource.netimGetMetricsFromClass(this.target.metricClassID);
    }

    // Retreive all differenciation options avalaible and send current grafana query-row letter

  }, {
    key: 'getDifferenciationOptions',
    value: function getDifferenciationOptions() {
      return this.datasource.netimGetDifferenciationList(this.target.refId || '');
    }

    // Retreives all curves returned by NetIM and send current grafana query-row letter

  }, {
    key: 'getAvailableCurveOptions',
    value: function getAvailableCurveOptions() {
      this.target.listOfCurves = this.datasource.netimGetCuvesList(this.target.refId);
      return this.target.listOfCurves;
    }

    // Retreive all rollup algorythm avalaible and send current grafana query-row letter

  }, {
    key: 'getRollupOptions',
    value: function getRollupOptions() {
      return this.datasource.metricFindRollupQuery(this.target.refId);
    }

    // When changing source type, bind False to all boolean (all boxes disapear)

  }, {
    key: 'disableAllBoxBool',
    value: function disableAllBoxBool() {
      this.target.displayDeviceBox = false;
      this.target.displayInterfaceBox = false;
      this.target.displayDifferenciationAndCurveBox = false;
    }

    // If source type 'Device' is selected, only his boolean is set to True

  }, {
    key: 'toggleDeviceBool',
    value: function toggleDeviceBool() {
      this.disableAllBoxBool();
      this.target.displayDeviceBox = true;
    }

    // If source type 'Interface' is selected, only his boolean is set to True

  }, {
    key: 'toggleInterfaceBool',
    value: function toggleInterfaceBool() {
      this.disableAllBoxBool();
      this.target.displayInterfaceBox = true;
    }

    // Method triggered by source type selection (a new query is being made), cleaning all up

  }, {
    key: 'runningSelect',
    value: function runningSelect() {
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

  }, {
    key: 'onChangeInternal',
    value: function onChangeInternal() {
      // this.target.displayDifferenciationAndCurveBox = this.datasource.needToggle(this.target.refId)
      this.panelCtrl.refresh(); // Asks the panel to refresh data.
      console.log("\nREFRESHED\n");
    }
  }]);

  return GenericDatasourceQueryCtrl;
}(_sdk.QueryCtrl);

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
//# sourceMappingURL=query_ctrl.js.map
