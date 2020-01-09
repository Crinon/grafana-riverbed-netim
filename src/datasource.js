import _ from "lodash";


export class GenericDatasource {
  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    // ID of the plugin (set in plugin.json)
    this.type = instanceSettings.type;
    // Name of the plugin (set in plugin.json)
    this.name = instanceSettings.name;
    // ID stored by Grafana
    this.IDplugin = instanceSettings.id;
    // Used for compilation by Grunt and query building
    this.deviceID = instanceSettings.deviceID;
    // Looks like '/api/datasources/proxy/{yourPluginIdGaveByGrafana}'. This proxy url avoids CORS issue
    this.urlDatasource = instanceSettings.url;

    // Theses login informations are set in plugin configuration page
    // First condition avoids error when grunt is building
    if (typeof instanceSettings.jsonData !== 'undefined') {
      // Second condition verifies that username and password for AppResponse API are actually set in plugin's config page
      if (typeof instanceSettings.jsonData.username !== 'undefined' && typeof instanceSettings.jsonData.password !== 'undefined') {
        this.datasourceUserName = instanceSettings.jsonData.username;
        this.datasourceUserPassword = instanceSettings.jsonData.password;
      }
    }

    // API for devices list retrievement (url completed with Grafana proxy)
    this.urlDevices = this.urlDatasource + '/api/netim/v1/devices';
    // API for interfaces (from one device) list retrievement, deviceID is completed in function (url completed with Grafana proxy)
    this.urlBaseInterfaces = this.urlDatasource + '/api/netim/v1/devices/';
    // API for metric classes list retrievement (url completed with Grafana proxy)
    this.urlMetricClasses = this.urlDatasource + '/api/netim/v1/metric-classes';
    // API for metric list retrievement (metrics from metric-class selected) (url completed with Grafana proxy)
    this.urlBaseMetrics = this.urlDatasource + '/api/netim/v1/metric-classes/';
    // API for metric report creation (url completed with Grafana proxy)
    this.urlReport = this.urlDatasource + '/api/netim/v1/metric-data';

    // Following variables are used as timer, to avoid unecessary requests to NetIM
    this.lastTimeYouWereDevicesList = 0;
    this.bufferMaxTime = 120000;
    this.timeListDevices = 0;

    // Variable for query construction
    this.devicesList = [];
    this.interfacesList = [];
    this.metricClassesList = [];
    this.metricsFromMetricClassList = [];
    this.lastMectricClassIDcalled;
    // Variable use as timer to prevent spam
    this.lastTimeYouWereInterfacesList = 0
    this.timeListInterfaces = 0;
    this.lastTimeYouWereMetricClassesList = 0;
    this.timeListMetricClasses = 0;
    this.lastTimeYouWereMetricsList = 0;
    this.lastTimeYouWeremetricsFromMetricClassList = 0;

    // With the Grail you have full access to both panel and datasource data
    this.graal;

    // Core variable
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.withCredentials = instanceSettings.withCredentials;
    // Default headers for DoRequest() function    
    this.headers = { 'Content-Type': 'application/json' };
    // NetIM uses basic authentication
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  //#########################################################################################################################
  //##                                                                                                                     ##
  //##                                                     CORE FUNCTION                                                   ##
  //##                                                                                                                     ##
  //#########################################################################################################################

  // Function to test if datasource is connected (only used when setting up the plugin in Grafana)
  testDatasource() {
    return this.doRequest({
      url: '/',
      method: 'GET',
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  // Function to send http request, options are url(proxy+api_endpoint), data(if there is data to send), and method(GET or POST))
  doRequest(options) {
    // Adding credentials and headers from self attributes 
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;
    return this.backendSrv.datasourceRequest(options);
  }

  // This function is used when Grunt build dist folder
  metricFindQuery(query) {
    let interpolated = {
      target: this.templateSrv.replace(query, null, 'regex')
    };
    return this.doRequest({
      url: this.url + '/fake_url',
      data: interpolated,
      method: 'POST',
    }).then(this.mapToTextValue);
  }

  // Annotation feature is not used in this plugin
  annotationQuery(options) {
    let query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
    let annotationQuery = {
      range: options.range,
      annotation: {
        name: options.annotation.name,
        datasource: options.annotation.datasource,
        enable: options.annotation.enable,
        iconColor: options.annotation.iconColor,
        query: query
      },
      rangeRaw: options.rangeRaw
    };

    return this.doRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: annotationQuery
    }).then(result => {
      return result.data;
    });
  }

  // Method giving the possibility to display text  but select id
  mapToTextValue(result) {
    return _.map(result.data, (d, i) => {
      // If there is an object with .value and .txt attribute in JSON
      if (d && d.text && d.value) {
        return { text: d.text, value: d.value };
      }
      // ???
      else if (_.isObject(d)) {
        return { text: d, value: i };
      }
      // In other cases just display same text and value
      return { text: d, value: d };
    });
  }



  // Method to construct the JSON that will be send to function query()
  buildQueryParameters(options) {
    // Extract targets array from object into simple array containing each target
    options.targets = _.filter(options.targets, target => {
      return target.target !== 'select metric';
    });

    // This variable is the JSON sent to function query()
    // Create an array containing every target, each target contains the following fields :
    let targets = _.map(options.targets, target => {
      return {
        // Each attribute is a field of the JSON
        target: this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
        refId: target.refId,
        hide: target.hide,
        deviceID: target.deviceID,
        metricID: target.metricID,
        interfaceID: target.interfaceID,
        metricClassID: target.metricClassID,
        differenciation: target.differenciation,
        selectedCurve: target.selectedCurve,
        DOMextractedRefID: target.DOMextractedRefID,
        rollupType: target.rollupType,
        type: target.type || '',
        listOfCurves: target.listOfCurves,
        displayDifferenciationAndCurveBox: target.displayDifferenciationAndCurveBox,
        timeshift: target.timeshift,
        customAlias: target.customAlias
      };
    });
    options.targets = targets;
    return options;
  }

  // These two last methods are not used in this datasource for the moment
  getTagKeys(options) {
    return new Promise((resolve, reject) => {
      this.doRequest({
        url: this.url + '/tag-keys',
        method: 'POST',
        data: options
      }).then(result => {
        return resolve(result.data);
      });
    });
  }

  getTagValues(options) {
    return new Promise((resolve, reject) => {
      this.doRequest({
        url: this.url + '/tag-values',
        method: 'POST',
        data: options
      }).then(result => {
        return resolve(result.data);
      });
    });
  }


  //#########################################################################################################################
  //##                                                                                                                     ##
  //##                                                     MY FUNCTIONS                                                    ##
  //##                                                                                                                     ##
  //#########################################################################################################################

  // Round value
  homeMadeRound(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
  }

  // Convert letter to his alaphabet position
  convertAlphabetPosition(letter) {
    return letter.charCodeAt(0) - 65;

    // // Return grafana's row letter alphabetical position (e.g between 0 and 25)
    // getGrafanaRowNumber() {
    //   // Depending of Grafana version, retrieving row's letter may differ
    //   let newlettre = $(document.activeElement).parents(".query-editor-row").find(".query-editor-row__ref-id").text();
    //   let oldLettre = $(document.activeElement).parents(".query-editor-row").find(".gf-form-query-letter-cell-letter").text();
    //   // 65 for uppercase, or 97 for lowercase
    //   // if length of String oldLettre is 0, then retrieving row's letter from old version has failed, we use newletter
    //   if (oldLettre.length == 0) {
    //     return newlettre.charCodeAt(0) - 65;
    //   } else {
    //     return oldLettre.charCodeAt(0) - 65;
    //   }
    // }
  }

  //#########################################################################################################################
  //##                                                                                                                     ##
  //##                                                     ROUTE FUNCTION                                                  ##
  //##                                                                                                                     ##
  //#########################################################################################################################

  // Ask NetIM all devices avalaible
  netimGetAllDevices() {
    // When openning your dashboard, Grafana repeats a lot the same request, this condition is used as anti-spam
    if (Date.now() - this.lastTimeYouWereDevicesList < 100) {
      return
    }
    this.lastTimeYouWereDevicesList = Date.now()

    // Check if we need to build a fresh list of devices available
    if (Date.now() - this.timeListDevices < this.bufferMaxTime) {
      return this.devicesList;
    }

    // If bufferMaxTime is passed, build a new devices list
    return this.doRequest({
      url: this.urlDevices,
      method: 'GET'
    }).then(
      (responseDevices) => {
        // Verify if request has failed 
        if (typeof responseDevices === 'undefined') {
          this.devicesList = []
        } else {
          // If successfull, store result as {'text': name, 'value': id}
          this.devicesList = [];
          for (let k in responseDevices.data.items) {
            this.devicesList.push({ 'text': responseDevices.data.items[k].name, 'value': responseDevices.data.items[k].name + ' {id}' + responseDevices.data.items[k].id });
          }
          this.timeListDevices = Date.now()
        }
        return this.devicesList
      }
    )
  }

  // Ask NetIM all interfaces available from device selected
  netimGetInterfacesFromDevice(deviceID) {
    let deviceSelected
    if (deviceID === '' || typeof deviceID === 'undefined') {
      return
    } else {
      // Gathering only id
      deviceSelected = deviceID.split(' {id}')[1]
    }
    let urlFullInterfaces = this.urlBaseInterfaces + deviceSelected + '/interfaces'

    // When openning your dashboard, Grafana repeats a lot the same request, this condition is used as anti-spam
    if (Date.now() - this.lastTimeYouWereInterfacesList < 100) {
      return
    }
    this.lastTimeYouWereInterfacesList = Date.now()

    // Check if we need to build a fresh list of interfaces available
    if (Date.now() - this.timeListInterfaces < 3000) {
      return this.interfacesList;
    }

    // If 3 secondes passed, build a new interfaces list
    return this.doRequest({
      url: urlFullInterfaces,
      method: 'GET'
    }).then(
      (responseInterfaces) => {
        // Verify if request has failed 
        if (typeof responseInterfaces === 'undefined') {
          this.interfacesList = []
        } else {
          // If successfull, store result as {'text': name, 'value': id}
          this.interfacesList = [];
          for (let k in responseInterfaces.data.items) {
            this.interfacesList.push({ 'text': responseInterfaces.data.items[k].name, 'value': responseInterfaces.data.items[k].name + ' {id}' + responseInterfaces.data.items[k].id });
          }
          this.timeListInterfaces = Date.now()
        }
        return this.interfacesList
      }
    )
  }

  // Ask NetIM all metric-class avalaible
  netimGetAllMetricClasses() {
    // When openning your dashboard, Grafana repeats a lot the same request, this condition is used as anti-spam
    if (Date.now() - this.lastTimeYouWereMetricClassesList < 100) {
      return
    }
    this.lastTimeYouWereMetricClassesList = Date.now()

    // Check if we need to build a fresh list of metric classes available
    if (Date.now() - this.timeListMetricClasses < this.bufferMaxTime) {
      return this.metricClassesList;
    }

    // If bufferMaxTime is passed, build a new metric-class list
    return this.doRequest({
      url: this.urlMetricClasses,
      method: 'GET'
    }).then(
      (responseMetricClasses) => {
        // Verify if request has failed 
        if (typeof responseMetricClasses === 'undefined') {
          this.metricClassesList = []
        } else {
          // If successfull, store result as {'text': name, 'value': id}
          this.metricClassesList = [];
          for (let k in responseMetricClasses.data.items) {
            this.metricClassesList.push({ 'text': responseMetricClasses.data.items[k].name, 'value': responseMetricClasses.data.items[k].name + ' {id}' + responseMetricClasses.data.items[k].id });
          }
          this.timeListMetricClasses = Date.now()
        }
        return this.metricClassesList
      }
    )
  }

  // Ask NetIM all metrics available from metric-class selected
  netimGetMetricsFromClass(mectricClassID) {
    // If user did not click on metric-class from another row before the current row, and if the list is not outdated
    if (this.lastMectricClassIDcalled === mectricClassID && Date.now() - this.timeThisListMetrics < this.bufferMaxTime) {
      return this.metricsFromMetricClassList
    }
    this.lastMectricClassIDcalled = mectricClassID

    // At initialization, plugin automaticaly tries this end point without any parameter, avoiding crash by testing parameter
    if (mectricClassID === '' || typeof mectricClassID === 'undefined') {
      return
    }
    // Gathering only id from parameter
    let metricClassSelected = mectricClassID.split(' {id}')[1]
    let urlFullMetrics = this.urlBaseMetrics + metricClassSelected

    // When openning your dashboard, Grafana repeats a lot the same request, this condition is used as anti-spam
    if (Date.now() - this.lastTimeYouWereMetricsList < 100) {
      return
    }
    this.lastTimeYouWereMetricsList = Date.now()

    // If bufferMaxTime is passed, build a new interfaces list
    return this.doRequest({
      url: urlFullMetrics,
      method: 'GET'
    }).then(
      (responseMetricsOfClass) => {
        // Verify if request has failed 
        if (typeof responseMetricsOfClass === 'undefined') {
          this.metricsFromMetricClassList = []
        } else {
          // If successfull, store result as {'text': name, 'value': id}
          this.metricsFromMetricClassList = [];
          for (let k in responseMetricsOfClass.data.metrics.items) {
            // If name field exists
            if (responseMetricsOfClass.data.metrics.items[k].name != '' && responseMetricsOfClass.data.metrics.items[k].name !== null) {
              // If 'units' field is not set, add (no units)
              if (responseMetricsOfClass.data.metrics.items[k].units === null || responseMetricsOfClass.data.metrics.items[k].units === '') {
                this.metricsFromMetricClassList.push({ 'text': responseMetricsOfClass.data.metrics.items[k].displayName + '  (no unit)', 'value': responseMetricsOfClass.data.metrics.items[k].displayName + '  (no unit)' + ' {id}' + responseMetricsOfClass.data.metrics.items[k].id });
              } else {
                // Else, use 'units' field
                this.metricsFromMetricClassList.push({ 'text': responseMetricsOfClass.data.metrics.items[k].displayName + '  (' + responseMetricsOfClass.data.metrics.items[k].units + ')', 'value': responseMetricsOfClass.data.metrics.items[k].displayName + '  (' + responseMetricsOfClass.data.metrics.items[k].units + ')' + ' {id}' + responseMetricsOfClass.data.metrics.items[k].id });
              }
            }
          }
        }
        this.timeThisListMetrics = Date.now()
        return this.metricsFromMetricClassList
      }
    )
  }

  // Return the differenciation list for the row specified in parameter (differenciationList is built in query())
  netimGetDifferenciationList(rowRefId) {
    // Get index from letter (e.g. rowRefId) using the graal variable, which contains every row
    // Looking for row's letter "refId" (for each target, build an array of all refId, and search rowRefId index in this new tab)
    let index = this.graal.targets.map(function (target) { return target.refId; }).indexOf(rowRefId);
    // First condition checks if rowRefId is correct, second checks if row is built
    if (typeof rowRefId !== 'undefined' && typeof this.graal.targets[index] !== 'undefined') {
      // Return the  
      return this.graal.targets[index].differenciationList
    }
  }

  // Return the curves list for the row specified in parameter (curves list is built in query())
  netimGetCuvesList(rowRefId) {
    // Get index from letter (e.g. rowRefId) using the graal variable, which contains every row
    // Looking for row's letter "refId" (for each target, build an array of all refId, and search rowRefId index in this new tab)
    let index = this.graal.targets.map(function (target) { return target.refId; }).indexOf(rowRefId);
    // First condition checks if rowRefId is correct, second checks if row is built
    if (typeof rowRefId !== 'undefined' && typeof this.graal.targets[index] !== 'undefined') {
      // Checking if corresponding curve list is built
      if (typeof this.graal.targets[index].curvesList !== 'undefined' && this.graal.targets[index].curvesList.length > 0) {
        // Return the curvesList built earlier in Query() function
        return this.graal.targets[index].curvesList
      }
    }
  }

  // Return the rollup list for the row specified in parameter (rollup list is built in query())
  metricFindRollupQuery(rowRefId) {
    // Get index from letter (e.g. rowRefId) using the graal variable, which contains every row
    // Looking for row's letter "refId" (for each target, build an array of all refId, and search rowRefId index in this new tab)
    let index = this.graal.targets.map(function (target) { return target.refId; }).indexOf(rowRefId);
    // First condition checks if row exists, second checks if row is built
    if (typeof rowRefId !== 'undefined' && typeof this.graal.targets[index] !== 'undefined') {
      // Checking if corresponding rollup list is built
      if (typeof this.graal.targets[index].rollupList === 'undefined' || this.graal.targets[index].rollupList.length === 0) {
        return { 'text': 'nothing', 'value': 'nothing' };
      }
      // Return the curvesList built earlier in Query() function
      return this.graal.targets[index].rollupList
    }
  }



  //#########################################################################################################################
  //##                                                                                                                     ##
  //##                                                     QUERY                                                           ##
  //##                                                                                                                     ##
  //#########################################################################################################################

  query(options) {
    // Function buildQueryParameters() return all data contained in each row
    let query = this.buildQueryParameters(options);
    // This global variable is used to access to data in other functions
    this.graal = query
    // This is use when user use dashboard
    const currentGraal = this.graal
    // Disable any hidden query ("eye" button at the right of a row)
    query.targets = query.targets.filter(t => !t.hide);

    // Debugging purpose
    // for (let i = 0; i <= query.targets.length; i++) {
    //   console.log("Query " + i);
    //   console.log(query.targets[i]);
    // }

    // If no query row, stop here
    if (query.targets.length <= 0) {
      return this.q.when({ data: [] });
    }

    if (this.templateSrv.getAdhocFilters) {
      query.adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    } else {
      query.adhocFilters = [];
    }

    let dataDefsWithList = [];
    let metricSplitted = [];
    let objectType;
    let objectId;
    let queryTimeMillisecFrom;
    let queryTimeMillisecTo;
    let allKeysWithId = [];
    let tempoTab;
    let selectedCurve;
    let metricHere;
    let metricClassSelected;
    let deviceID;
    let interfaceID;
    let differenciationSelected;
    let rollupBoolean;
    let rollupSelected;
    let sourceType;
    let metricsForLegend = [];
    let devicesForLegend = [];
    let interfacesForLegend = [];
    let deviceOrInterfaceName = "A REMPLACER";
    let metricId = "CHANGER";
    // This array is used for checking if query is ready or not
    let booleanArrayQueryReady = [];
    let rollupListFormated = [];
    let deltaTimeshift;
    let deux;

    // List returned to Grafana at the very end of this function, will contain results
    let dataPointsForGrafana = []
    // Retrieving times queried from Grafana's JSON (string epoch format needed, in milliseconds)
    let SOLIDqueryTimeMillisecFrom = ((new Date(query.range.from)).getTime());
    let SOLIDqueryTimeMillisecTo = ((new Date(query.range.to)).getTime());

    // For each row of Grafana query (A, B, C, D...) : send NetIM query and build results in appropriate format
    for (let i in query.targets) {



      //##################################################################
      //##                   Dealing with timeshift                     ##
      //##################################################################
      // To do timeshift, we take Grafana query time, substract how many days back we need, do the request, add timeshift back to display correctly
      // If timeshift field is empty, timeshift is set to 0
      if (typeof query.targets[i].timeshift === "undefined" ||
        (typeof query.targets[i].timeshift === "string" && query.targets[i].timeshift.length === 0)) {
        query.targets[i].timeshift = 0;
      }
      // Timeshift is converted from string to number
      query.targets[i].timeshift = parseInt(query.targets[i].timeshift)
      // Timeshift is converted from day to milliseconds (and corrected by one seconds per day)
      query.targets[i].timeshift = query.targets[i].timeshift * 86400 * 1000
      // Store timeshift to calculate delta 
      deltaTimeshift = query.targets[i].timeshift

      // Substract queryTime from timeshift 
      queryTimeMillisecFrom = SOLIDqueryTimeMillisecFrom - deltaTimeshift
      queryTimeMillisecTo = SOLIDqueryTimeMillisecTo - deltaTimeshift



      //##################################################################
      //##       Checking if NetIM requests are ready to be send        ##
      //##################################################################
      // Check if a device has been selected (deviceID is device identifier)
      deviceID = query.targets[i].deviceID
      if (typeof deviceID === 'undefined') {
        booleanArrayQueryReady[i] = false
        console.log("#### REQUEST ", i, " ABORTED (no device picked) #####")
        continue
      }

      // SourceType is one of device or interface
      sourceType = query.targets[i].type
      interfaceID = query.targets[i].interfaceID
      if (sourceType === 'Interface' && interfaceID === '') {
        booleanArrayQueryReady[i] = false
        console.log("#### REQUEST ", i, " ABORTED (no interface picked) #####")
        continue
      }

      // Check if a metricClass has been selected (metricClassID is metric class identifier)
      let metricClassID = query.targets[i].metricClassID
      if (metricClassID === '') {
        booleanArrayQueryReady[i] = false
        console.log("#### REQUEST ", i, " ABORTED (no metric class picked) #####")
        continue
      }
      // Gathering only id
      metricClassSelected = metricClassID.split(' {id}')[1]

      // metricID is metric identifier
      let metricID = query.targets[i].metricID
      if (metricID === '') {
        booleanArrayQueryReady[i] = false
        console.log("#### REQUEST ", i, " ABORTED (no metric picked) #####")
        continue
      }
      // Gathering only id
      let metricSelected = metricID
      metricSelected = metricID.split(' {id}')[1]

      if (sourceType == 'Device') {
        objectType = 'DEVICE'
        objectId = query.targets[i].deviceID
      }
      if (sourceType == 'Interface') {
        objectType = 'INTERFACE'
        objectId = query.targets[i].interfaceID
      }

      // Gathering only id
      let objectSelected = objectId
      objectSelected = objectId.split(' {id}')[1]

      // Retrieving metric queried by Grafana (default is '')
      metricSplitted = query.targets[i].metricID.split(' {id}')

      metricsForLegend[metricSplitted[1]] = metricSplitted[0]
      devicesForLegend[query.targets[i].deviceID.split(' {id}')[1]] = query.targets[i].deviceID.split(' {id}')[0]
      interfacesForLegend[query.targets[i].interfaceID.split(' {id}')[1]] = query.targets[i].deviceID.split(' {id}')[0] + " / " + query.targets[i].interfaceID.split(' {id}')[0]

      // Tag request as complete
      booleanArrayQueryReady[i] = true


      //##################################################################
      //##                      Building NetIM queries                  ##
      //##################################################################
      // Declaring all fields needed for a Riverbed creating instance request (data_defs)
      // 12 known properties: "metricClassId", "includeRawSummary", "endTime", "epoch", "durationMinutes", "metricId", "startTime", "maxRawDurationForSummaryInHours", "objectType", "objectId", "includeSummary"
      let dataDefs;
      dataDefs = {
        'startTime': queryTimeMillisecFrom,
        'endTime': queryTimeMillisecTo,
        'metricClassId': metricClassSelected,
        'metricId': [metricSelected],
        'objectType': objectType,
        'objectId': [objectSelected]
      }
      // Adding these dataDefinitions to the array containing all datadefs
      dataDefsWithList[i] = dataDefs;
      // End of foreach query, moving to http request(s) section
    }



      //##################################################################
      //##                      Queries treatment                       ##
      //##################################################################

    // To avoid same request, add fake request to dataDefsWithList
    for (let index in booleanArrayQueryReady) {
      if (booleanArrayQueryReady[index] === false) {
        dataDefsWithList[index] = { 0: "This artificial query was added" };
      }
    }

    // Create dataDefsWithList frozen
    const fixedataDefsWithList = dataDefsWithList.map((x) => { return x })

    // Create dataDefsWithList but with row-letter as key
    let datadefsWithLetter = []
    for (let i in query.targets) {
      datadefsWithLetter[query.targets[i].refId] = fixedataDefsWithList[i]
    }

    // Creating mirror variable, it will contain information about duplicate query and incomplete query
    // A master request is a request that will be send to NetIM and may be duplicated or not
    // Incomplete query are not duplicated
    let mirror = []
    let found = false
    let indexOfDuplicate = []
    let alreadyFound = []
    for (let dupCounter in dataDefsWithList) {
      // If query is an incomplete query, tag it as artificial query
      if (dataDefsWithList[dupCounter][0] === "This artificial query was added") {
        mirror[dupCounter] = [query.targets[dupCounter].refId, dataDefsWithList[dupCounter][0]]
        continue
      }
      // If the key is already tagged as duplicate, continue to next key (empty space in array are duplicate row)
      if (alreadyFound.includes(dupCounter)) {
        continue
      }
      // Searching now for duplicate
      for (let dupCounterBis in dataDefsWithList) {
        // If one of the other row is a duplicate (JSON.stringify is used to compare object fileds instead of object adress)
        if ((JSON.stringify(dataDefsWithList[dupCounter]) === JSON.stringify(dataDefsWithList[dupCounterBis])) && dupCounter !== dupCounterBis) {
          // Trigger boolean and push index of duplicate in array
          found = true
          indexOfDuplicate.push(dupCounterBis)
        }
      }
      // If request is already saved, push duplicate index in master row (master won't be delete)
      if (found === true) {
        mirror[dupCounter] = [query.targets[dupCounter].refId]
        for (let counter in indexOfDuplicate) {
          mirror[dupCounter].push([query.targets[indexOfDuplicate[counter]].refId, indexOfDuplicate[counter]])
          alreadyFound.push(indexOfDuplicate[counter])
        }
      // Else, save request as master
      } else {
        mirror[dupCounter] = [query.targets[dupCounter].refId]
        alreadyFound.push(dupCounter)
      }
      // Reset variable
      found = false
      indexOfDuplicate = []
    }


    // Creating variable to send to NetIM, containing all query without duplicate and incomplete query
    // In the mean time, creating clone but with letter as key
    let sendingDataWithLetter = []
    let sendingData = []
    for (let i in mirror) {
      // Dans le mirroir, les seuls indexs sont de vraies requêtes sauf les articifielles
      if (mirror[i][1] !== "This artificial query was added") {
        sendingDataWithLetter[mirror[i][0]] = datadefsWithLetter[mirror[i][0]]
        sendingData.push(datadefsWithLetter[mirror[i][0]])
      }
    }


    // Creating array to know which index is which letter in data sent to NetIM (e.g. 5 : B)
    let indexOfLetterInDataDefsSent = []
    let counter = 0
    for (var key in sendingDataWithLetter) {
      if (key === 'length' || !sendingDataWithLetter.hasOwnProperty(key)) continue;
      indexOfLetterInDataDefsSent[counter] = key
      counter++
    }



    //##################################################################
    //##                      Sending NetIM queries                   ##
    //##################################################################
    // All promises (e.g http requests) are stored in this array
    let promises = []
    // Sending all datadefs to Riverbed NetIM (=Execute every promise)
    for (let currentDataDefs in sendingData) {
      promises[currentDataDefs] = this.doRequest({
        url: this.urlReport,
        data: sendingData[currentDataDefs],
        method: 'POST'
      });
    }




    //##################################################################
    //##                                                              ##
    //##                         GATHERING                            ##
    //##                          NETIM's                             ##
    //##                           DATA                               ##
    //##                                                              ##
    //##################################################################
    //  Waiting for all promise to be returned by NetIM
    return this.q.all(promises).then(responseQuery => {
      console.log("#### RESPONSES PROCESSING ####")


    //##################################################################
    //##                      Response reconstruction                 ##
    //##################################################################
    // Earlier, duplicated and incomplete request were deleted, we need to rebuilt them
      // Freeze response
      let reserved = responseQuery.map(x => x)
      Object.freeze(reserved)

      // Copy response in array with row-letter as key
      let finalLetteredResponse = []
      for (let i in reserved) {
        finalLetteredResponse[indexOfLetterInDataDefsSent[i]] = reserved[i]
      }

      // Rebuild response with all duplicated query and incomplete query
      let letterToGet
      let corresIndex
      for (let i in mirror) {
        // Skip unique row of mirror (unique row is not a duplicated query)
        if (mirror[i].length > 1)
          for (let u in mirror[i]) {
            if (u !== '0') {
              // Duplicated query found, copying it at his corresponding index
              if (mirror[i][u] !== "This artificial query was added") {
                letterToGet = mirror[i][0]
                corresIndex = indexOfLetterInDataDefsSent.indexOf(letterToGet)
                finalLetteredResponse[mirror[i][u][0]] = reserved[corresIndex]
              }
              // Incomplete query found, adding it to response
              else {
                finalLetteredResponse[mirror[i][0]] = ["This artificial query was re-added"]
              }
            }
          }
      }

      // Retrieve Grafana row order as user see them
      let realOrder = []
      for (let row in query.targets) {
        realOrder.push(query.targets[row].refId)
      }

      // Ordering response in the same order as Grafana row order
      let modify = []
      for (let index in realOrder) {
        modify[index] = finalLetteredResponse[realOrder[index]]
      }
      responseQuery = modify




      // For each NetIM's response 
      for (let currentQuery in responseQuery) {
        // Little fail in array duplication
        if (currentQuery >= query.targets.length) {
          console.log("FATAL ERROR NEED CORRECTION")  // This bug seems to have vanished
          continue
        }

        if (typeof responseQuery[currentQuery] === 'undefined') {
          console.log('###### ROW ' + currentQuery + ' unexpected error : response is empty #####')
          console.log(responseQuery[currentQuery])
          continue;
        }
        if (responseQuery[currentQuery][0] === "This artificial query was re-added") {
          console.log('Artificial request, skip')
          continue
        }
        if (typeof responseQuery[currentQuery].data === 'undefined') {
          console.log('###### ROW ' + currentQuery + ' unexpected error : no data in response  #####')
          continue;
        }

        if (typeof responseQuery[currentQuery].data.items === 'undefined') {
          console.log('###### DATA POINT ERROR FOR ROW ' + currentQuery + '  #####')
          continue;
        }

        if (typeof responseQuery[currentQuery].data.items[0] === 'undefined') {
          console.log('###### NO DATA POINT FOR ROW ' + currentQuery + '  #####')
          continue;
        }

        // Datapoint is a list which will receive all datapoints in correct format [value, timestamp]
        let datapoints = []

        // Check timeshift
        if (typeof query.targets[currentQuery].timeshift !== 'undefined') {
          deltaTimeshift = query.targets[currentQuery].timeshift
        } else {
          deltaTimeshift = 0
        }

        // Get the metric requested in order to select it in samples from NetIM
        metricSplitted = query.targets[currentQuery].metricID.split(' {id}')
        metricHere = metricSplitted[1]

        // valeurs is an array containing all data requested (rollup, timestamp, metric....)
        let valeurs = responseQuery[currentQuery].data.items[0].samples.items

        // Need to delete first empty datapoints
        let untilAllEmptyDatapointsAreDeleted = true
        while (untilAllEmptyDatapointsAreDeleted && valeurs.length > 0) {
          if (valeurs[0].timestamp === '0') {
            // Starting at index position 0, remove 1 element
            valeurs.splice(0, 1)
          } else {
            // All empty points are deleted (they are in first positions)
            untilAllEmptyDatapointsAreDeleted = false
          }
        }


        //##################################################################
        //##                   Generating differenciation list            ##
        //##################################################################
        // Sometimes NetIM response contains severals differents metrics for one source requested (e.g class 1, class 2, cpuIndex0, cpuIndex1...)
        // Retrieves all keys field from samples (e.g timestamp, cpuUtil, availability...)
        let allKeys = Object.keys(valeurs[0].values)
        allKeysWithId = []
        for (let k in allKeys) {
          // Use correct format for angular dropdown ({text : y, value : x})
          if (allKeys[k] != "timestamp" && allKeys[k] != metricHere) {
            allKeysWithId.push({ 'text': allKeys[k], 'value': allKeys[k] })
          }
        }
        // Assign allKeysWithId to differenciationList
        query.targets[currentQuery].differenciationList = allKeysWithId
        // Rebuild queryObject with differenciationList
        currentGraal.targets[currentQuery].differenciationList = query.targets[currentQuery].differenciationList

        // End of this section, now function netimGetDifferenciationList() will return differents choice to separate values





        //##################################################################
        //##                       Generating rollup list                 ##
        //##################################################################
        // Rollup list is built from fields in valeurs
        let rollupListRaw = []
        for (let i in valeurs) {
          if (typeof valeurs[i].rollupAlgo !== 'undefined' && !rollupListRaw.includes(valeurs[i].rollupAlgo)) {
            rollupListRaw.push(valeurs[i].rollupAlgo)
          }
        }
        // Rollup list is recreated with correct format
        rollupListFormated = []
        for (let i in rollupListRaw) {
          rollupListFormated.push({ 'text': rollupListRaw[i], 'value': rollupListRaw[i] })
        }

        // This section may be useless now, further tests are needed
        let search = true
        let compte = -1
        if (typeof query.targets[this.convertAlphabetPosition(query.targets[currentQuery].refId)] === 'undefined') {
          // 27 count is use as safety measure
          while (search || compte === 27) {
            compte += 1
            if (currentGraal.targets[compte].refId === currentGraal.targets[currentQuery].refId) {
              search = false
            }
          }
          currentGraal.targets[compte].rollupList = rollupListFormated
        } else {
          // Store rollup list
          currentGraal.targets[currentQuery].rollupList = rollupListFormated
        }







        //##################################################################
        //##             Datapoints gathering for simple request          ##
        //##################################################################      
        // If there is no need to separate values from each over, we can build the datapoints variable 

        rollupBoolean = valeurs[0].rollup
        // If rollup is needed (e.g. query > 24 hours), then we need to built the rollup list
        if (rollupBoolean) {
          rollupSelected = query.targets[currentQuery].rollupType
          // If rollup is needed and no rollup is selected, use first rollup available as default
          if ((typeof rollupSelected === 'undefined' || rollupSelected === '') && (rollupListRaw.length > 0)) {
            // Case sensitive, strict string of characters "avg"
            // If multi avg, it pick first encountered
            var tryDefaultRollupAverage = rollupListRaw.find(a => a.includes("avg"));
            rollupSelected = tryDefaultRollupAverage
            if (typeof tryDefaultRollupAverage === 'undefined') {
              rollupSelected = rollupListRaw[0]
            }
          }
        }

        differenciationSelected = currentGraal.targets[currentQuery].differenciation

        rollupBoolean = valeurs[0].rollup

        if (typeof differenciationSelected !== 'undefined' && typeof query.targets[currentQuery].selectedCurve !== 'undefined') {
          // Reset rawResults (array with all fields, not filtered (every className, ....))
          currentGraal.targets[currentQuery].rawResults = []
          // Filling datapoints
          if (typeof valeurs[0].values[metricHere] === 'undefined') {
            console.log("Ambiguous request, aborting")
            console.log("Metric recorded :", metricHere)
            console.log("values :", valeurs)
            break
          }

          for (let k in valeurs) {
            if (rollupBoolean === false || (rollupBoolean === true && rollupSelected === valeurs[k].rollupAlgo)) {
              currentGraal.targets[currentQuery].rawResults.push(valeurs[k].values)
              let res;
              // Timestamp received is a string, in seconds (need to be converted to int and milliseconds)
              // Adding 60 seconds to synchronize probe's clock and Grafana's clock and timeshift (0 if no timeshift)
              let timeStampInteger = (parseInt(valeurs[k].timestamp) + 60) + deltaTimeshift
              // If there is a value
              if (valeurs[k].values[metricHere] !== '') {
                res = this.homeMadeRound(parseFloat(valeurs[k].values[metricHere].replace(",", ".")), 5);
              } else {
                // Else, put 0
                res = 0
              }
              // Adding couple [valeurs[k], timestamp] to datapoints list
              datapoints.push([res, timeStampInteger])
            }
          }
        }
        //##################################################################
        //##                    Curves list building                      ##
        //##################################################################
        // Browse all results to find avalaible choices (classD1, classD2, classD3 ...)
        differenciationSelected = query.targets[currentQuery].differenciation

        if (query.targets[currentQuery].differenciation !== '') {
          currentGraal.targets[currentQuery].curvesAvalaibleList = []
          currentGraal.targets[currentQuery].curvesAvalaibleDatapointed = {}

          // If differenciationList length > 0 then there is work to do
          if (typeof currentGraal.targets[currentQuery].differenciationList !== 'undefined' && currentGraal.targets[currentQuery].differenciationList.length >= 1) {
            // Empty curvesList before creation
            currentGraal.targets[currentQuery].curvesList = []
            for (let u in currentGraal.targets[currentQuery].rawResults) {
              // Avoid repetition
              if (!currentGraal.targets[currentQuery].curvesList.includes(currentGraal.targets[currentQuery].rawResults[u][differenciationSelected])) {
                currentGraal.targets[currentQuery].curvesList.push(currentGraal.targets[currentQuery].rawResults[u][differenciationSelected])
              }
            }
            tempoTab = []
            tempoTab = currentGraal.targets[currentQuery].curvesList
            currentGraal.targets[currentQuery].curvesList = []
            for (let v in currentGraal.targets[currentQuery].rawResults) {
              // Avoid repetition
              if (typeof tempoTab[v] !== 'undefined')
                currentGraal.targets[currentQuery].curvesList.push({ 'text': tempoTab[v], 'value': tempoTab[v] })
            }
          }
        }


        //##################################################################
        //##                 Differenciation data building                ##
        //##################################################################
        if (query.targets[currentQuery].selectedCurve !== '') {
          selectedCurve = query.targets[currentQuery].selectedCurve
          datapoints = []

          // Filling datapoints
          for (let k in currentGraal.targets[currentQuery].rawResults) {
            if (currentGraal.targets[currentQuery].rawResults[k][differenciationSelected] === selectedCurve) {
              currentGraal.targets[currentQuery].rawResults.push(currentGraal.targets[currentQuery].rawResults[k][metricHere])
              let res;
              let timeStampInteger = (parseInt(currentGraal.targets[currentQuery].rawResults[k].timestamp) + 60) + deltaTimeshift
              if (currentGraal.targets[currentQuery].rawResults[k][metricHere] % 1 === 0) {
                res = this.homeMadeRound(parseFloat(currentGraal.targets[currentQuery].rawResults[k][metricHere].replace(",", ".")), 5);
              }
              // Change string to float 
              else if (typeof (currentGraal.targets[currentQuery].rawResults[k][metricHere]) === 'string') {
                res = this.homeMadeRound(parseFloat(currentGraal.targets[currentQuery].rawResults[k][metricHere].replace(",", ".")), 5);
              }
              // No change if float encountered
              else if (currentGraal.targets[currentQuery].rawResults[k][metricHere] % 1 !== 0) {
                res = this.homeMadeRound(currentGraal.targets[currentQuery].rawResults[k][metricHere], 5)
              }
              // Adding couple [currentGraal.targets[currentQuery].rawResults[k], timestamp] to datapoints list
              deux = timeStampInteger
              datapoints.push([res, timeStampInteger])
            }
          }
        }



        //##################################################################
        //##                    Curve's legend generation                 ##
        //##################################################################



        // If objectId is in devicesForLegend tab, then it's a device
        if (typeof devicesForLegend[responseQuery[currentQuery].data.items[0].objectId] !== 'undefined') {
          deviceOrInterfaceName = devicesForLegend[responseQuery[currentQuery].data.items[0].objectId]
        } else {
          // Else, it's an interface
          deviceOrInterfaceName = interfacesForLegend[responseQuery[currentQuery].data.items[0].objectId]
        }
        differenciationSelected = query.targets[currentQuery].differenciation
        // Case of request with only differenciation 
        if (differenciationSelected == '' && query.targets[currentQuery].selectedCurve == '') {
          metricId = metricHere
        }

        // Case of request with both differenciation and curve selection
        if (differenciationSelected !== '' && query.targets[currentQuery].selectedCurve !== '') {
          metricId = metricHere + " (" + differenciationSelected + " " + query.targets[currentQuery].selectedCurve + ")"
        }

        // Label contains both deviceOrInterfaceName and metric name
        let label = deviceOrInterfaceName + ' : ' + metricId

        // In case of query with rollup (e.g. query with time range >= 24h)
        if (typeof rollupSelected !== 'undefined') {
          label = label + " [" + rollupSelected + "]"
        }


        // If user specifies "alias" field, then label is alias
        if (typeof query.targets[currentQuery].customAlias !== 'undefined' && query.targets[currentQuery].customAlias.length > 0) {
          label = query.targets[currentQuery].customAlias
        } else {
          //  If no alias is specified, if timeshift field is used, add the number of day to label
          if (query.targets[currentQuery].timeshift > 0) {
            label = label + "_" + query.targets[currentQuery].timeshift / 86400000 + "day"
          }
        }


        //##################################################################
        //##                        Build panel data                      ##
        //##################################################################
        // If differenciation is required and user did not select both differenciation and curve, do not send datapoints to panel
        if (
          (typeof currentGraal.targets[currentQuery].differenciationList !== 'undefined' &&
            currentGraal.targets[currentQuery].differenciationList.length >= 1 &&
            query.targets[currentQuery].selectedCurve == '') ||
          (typeof currentGraal.targets[currentQuery].curvesList !== 'undefined' &&
            currentGraal.targets[currentQuery].curvesList.length >= 1 &&
            query.targets[currentQuery].selectedCurve == '')
        ) {
          // do nothing 
        } else {
          // If user filled all required fields, send results to panel
          let grafanaRefId = query.targets[currentQuery].refId;
          // Object representating each row's of Grafana (contains deviceOrInterfaceName, meta informations, row's id, collection time, and datapoints)
          let newTarget = {
            // target is curve's legend
            "target": label,
            // meta is miscellaneous informations
            "meta": { 'info 1': 'miscancellious' },
            // refId is the letter of the row (A, B, C, D ...)
            'refId': grafanaRefId,
            // datapoints is a list containing all points retrieved by Riverbed AppResponse probe
            "datapoints": datapoints
          };
          // Each target (or row) is insert into a list (will be send to Grafana)
          dataPointsForGrafana.push(newTarget)
          deltaTimeshift = 0
        }
      }
      this.graal = currentGraal
      // When no query built, this return avoid error
      if (typeof responseQuery[0] === 'undefined') {
        responseQuery.data = dataPointsForGrafana
        return responseQuery
      }
      responseQuery.push({ 'desc': "Object returned to panel", 'data': dataPointsForGrafana })
      // Return last entry, contains all data to display
      return responseQuery[responseQuery.length - 1]
    });
  }
}