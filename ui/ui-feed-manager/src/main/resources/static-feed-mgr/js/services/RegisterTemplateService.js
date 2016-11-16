/*
 * Copyright (c) 2016.
 */

/**
 *
 */
angular.module(MODULE_FEED_MGR).factory('RegisterTemplateService', function ($http, $q, $mdDialog, RestUrlService, FeedInputProcessorOptionsFactory, FeedDetailsProcessorRenderingHelper) {

  function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  }

  var data = {
    /**
     * Properties that require custom Rendering, separate from the standard Nifi Property (key  value) rendering
     * This is used in conjunction with the method {@code this.isCustomPropertyRendering(key)} to determine how to render the property to the end user
     */
    customPropertyRendering: ["metadata.table.targetFormat", "metadata.table.feedFormat"],

    codemirrorTypes: null,
    propertyRenderTypes: [{type: 'text', 'label': 'Text'}, {type: 'number', 'label': 'Number', codemirror: false},
      {type: 'textarea', 'label': 'Textarea', codemirror: false}, {type: 'select', label: 'Select', codemirror: false},
      {type: 'checkbox-custom', 'label': 'Checkbox', codemirror: false}],
    trueFalseRenderTypes: [{type: 'checkbox-true-false', 'label': 'Checkbox', codemirror: false},
      {type: 'select', label: 'Select', codemirror: false}],
    selectRenderType: [{type: 'select', 'label': 'Select', codemirror: false},
      {type: 'radio', label: 'Radio Button', codemirror: false}],
    codeMirrorRenderTypes: [],
    configurationProperties: [],
    metadataProperties: [],
    propertyList: [],
    configurationPropertyMap: {},
    model: null,
    emptyModel: {
      id: null,
      nifiTemplateId: null,
      templateName: '',
      description: '',
      processors: [],
      inputProperties: [],
      additionalProperties: [],
      inputProcessors: [],
      nonInputProcessors: [],
      defineTable: true,
      allowPreconditions: false,
      dataTransformation: false,
      reusableTemplate: false,
      needsReusableTemplate: false,
      ports: [],
      reusableTemplateConnections:[],  //[{reusableTemplateFeedName:'', feedOutputPortName: '', reusableTemplateInputPortName: ''}]
      icon: {title: null, color: null},
      state:'NOT REGISTERED',
        updateDate:null,
        feedsCount:0,
      registeredDatasources:[]
    },
    newModel: function () {
      this.model = angular.copy(this.emptyModel);
    },
    resetModel: function () {
      angular.extend(this.model, this.emptyModel);
      this.model.icon = {title: null, color: null}
    },
    init: function () {
      this.newModel();
      this.fetchConfigurationProperties();
      this.fetchMetadataProperties();
      this.getCodeMirrorTypes();
    },
    getModelForSave: function () {
      return {
        properties: this.getSelectedProperties(),
        id: this.model.id,
        description: this.model.description,
        defineTable: this.model.defineTable,
        allowPreconditions: this.model.allowPreconditions,
        dataTransformation: this.model.dataTransformation,
        nifiTemplateId: this.model.nifiTemplateId,
        templateName: this.model.templateName,
        icon: this.model.icon.title,
        iconColor: this.model.icon.color,
        reusableTemplate: this.model.reusableTemplate,
        needsReusableTemplate: this.model.needsReusableTemplate,
        reusableTemplateConnections: this.model.reusableTemplateConnections,
        state:this.model.state
      }
    },
    newReusableConnectionInfo: function() {
      return [{reusableTemplateFeedName:'', feedOutputPortName: '', reusableTemplateInputPortName: ''}];
    },
    isSelectedProperty: function (property) {
      var selected = (property.selected || ( property.value != null && property.value != undefined && (property.value.includes("${metadata") || property.value.includes("${config."))) );
      if (selected) {
        property.selected = true;
      }
      return selected;
    },
    getSelectedProperties: function () {
      var self = this;
      var selectedProperties = [];

      angular.forEach(self.model.inputProperties, function (property) {
        if (data.isSelectedProperty(property)) {
          selectedProperties.push(property)
          if (property.processor && property.processor.topIndex != undefined) {
            delete property.processor.topIndex;
          }
        }
      });


      angular.forEach(self.model.additionalProperties, function (property) {
        if (data.isSelectedProperty(property)) {
          selectedProperties.push(property);
          if (property.processor && property.processor.topIndex != undefined) {
            delete property.processor.topIndex;
          }
        }
      });
      return selectedProperties;
    },
    sortPropertiesForDisplay: function (properties) {
      var propertiesAndProcessors = {properties: [], processors: []};

      //sort them by processor name and property key
      var arr = _.chain(properties).sortBy('key').sortBy('processorName').value();
      propertiesAndProcessors.properties = arr;
      //set the initial processor flag for the heading to print
      var lastProcessor = null;
      _.each(arr, function (property, i) {
        if (lastProcessor == null || property.processor.id != lastProcessor) {
          property.firstProperty = true;
          propertiesAndProcessors.processors.push(property.processor);
          property.processor.topIndex = i;
        }
        else {
          property.firstProperty = false;
        }
        lastProcessor = property.processor.id;
      });
      return propertiesAndProcessors;
    },
    fetchConfigurationProperties: function (successFn, errorFn) {

      var self = this;
      if (self.configurationProperties.length == 0) {
        var _successFn = function (response) {
          self.configurationProperties = response.data;
          angular.forEach(response.data, function (value, key) {
            self.propertyList.push({key: key, value: value, description: null, dataType: null, type: 'configuration'});
            self.configurationPropertyMap[key] = value;
          })
          if (successFn) {
            successFn(response);
          }
        }
        var _errorFn = function (err) {
          if (errorFn) {
            errorFn(err)
          }
        }

        var promise = $http.get(RestUrlService.CONFIGURATION_PROPERTIES_URL);
        promise.then(_successFn, _errorFn);
        return promise;
      }

    },
    fetchMetadataProperties: function (successFn, errorFn) {
      var self = this;
      if (self.metadataProperties.length == 0) {
        var _successFn = function (response) {
          self.metadataProperties = response.data;
          angular.forEach(response.data, function (annotatedProperty, i) {
            self.propertyList.push({
              key: annotatedProperty.name,
              value: '',
              dataType: annotatedProperty.dataType,
              description: annotatedProperty.description,
              type: 'metadata'
            });
          })
          if (successFn) {
            successFn(response);
          }
        }
        var _errorFn = function (err) {
          if (errorFn) {
            errorFn(err)
          }
        }

        var promise = $http.get(RestUrlService.METADATA_PROPERTY_NAMES_URL);
        promise.then(_successFn, _errorFn);
        return promise;
      }

    },
    fetchRegisteredReusableFeedInputPorts : function(){

    var successFn = function (response) {
      self.feedInputPortMap = response.data;
    }
    var errorFn = function (err) {

    }
    var promise = $http.get(RestUrlService.ALL_REUSABLE_FEED_INPUT_PORTS);
    promise.then(successFn, errorFn);
    return promise;

  },
    replaceAll: function (str, find, replace) {
      return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    },
    deriveExpression: function (expression, configOnly) {
      var self = this;
      var replaced = false;
      if (expression != null && expression != '') {
        var variables = expression.match(/\$\{(.*?)\}/gi);
        if (variables && variables.length) {
          angular.forEach(variables, function (variable) {
            var varNameMatches = variable.match(/\$\{(.*)\}/);
            var varName = null;
            if (varNameMatches.length > 1) {
              varName = varNameMatches[1];
            }
            if (varName) {
              var value = self.configurationPropertyMap[varName];
              if (value) {
                expression = self.replaceAll(expression, variable, value);
                replaced = true;
              }

            }
          });
        }
      }
      if(configOnly == true && !replaced){
        expression = '';
      }
      return expression;
    },
    getCodeMirrorTypes: function () {
      var self = this;
      if (this.codemirrorTypes == null) {
        var successFn = function (response) {
          self.codemirrorTypes = response.data;
          angular.forEach(self.codemirrorTypes, function (label, type) {
            self.propertyRenderTypes.push({type: type, label: label, codemirror: true});
          });
        }
        var errorFn = function (err) {

        }
        var promise = $http.get(RestUrlService.CODE_MIRROR_TYPES_URL);
        promise.then(successFn, errorFn);
        return promise;
      }
      return $q.when(self.codemirrorTypes);
    },
    isRenderPropertyWithCodeMirror: function (property) {
      return this.codemirrorTypes[property.renderType] !== undefined;
    },
    /**
     * Feed Processors can setup separate Templates to have special rendering done for a processors properties.
     * @see /js/define-feed/feed-details/get-table-data-properties.
     *  This
     * @param key
     * @returns {boolean}
     */
    isCustomPropertyRendering: function (key) {
      var self = this;
      var custom = _.find(this.customPropertyRendering, function (customKey) {
        return key == customKey;
      });
      return custom !== undefined;
    },

    /**
     * Gets all templates registered or not.  (looks at Nifi)
     * id property will ref NiFi id
     * registeredTemplateId property will be populated if registered
     * @returns {HttpPromise}
     */
    getTemplates : function () {
    var successFn = function (response) {

    }
    var errorFn = function (err) {

    }

    var promise = $http.get(RestUrlService.GET_TEMPLATES_URL);
    promise.then(successFn, errorFn);
    return promise;
      },

    /**
     * Gets the Registered Templates
     * @returns {HttpPromise}
     */
    getRegisteredTemplates : function () {
      var successFn = function (response) {

      }
      var errorFn = function (err) {

      }

      var promise = $http.get(RestUrlService.GET_REGISTERED_TEMPLATES_URL);
      promise.then(successFn, errorFn);
      return promise;
    },
    removeNonUserEditableProperties: function (processorArray, keepProcessorIfEmpty) {
      //only keep those that are userEditable:true
      var validProcessors = [];
      var processorsToRemove = [];
      //temp placeholder until Register Templates allows for user defined input processor selection

      _.each(processorArray, function (processor, i) {
        var validProperties = _.reject(processor.properties, function (property) {
          return !property.userEditable;
        });
        processor.allProperties = processor.properties;

        processor.properties = validProperties;
        if (validProperties != null && validProperties.length > 0) {
          validProcessors.push(processor);
        }
        if (FeedDetailsProcessorRenderingHelper.isGetTableDataProcessor(processor) || FeedDetailsProcessorRenderingHelper.isWatermarkProcessor(processor)) {
          processor.sortIndex = 0;
        }
        else {
          processor.sortIndex = i;
        }
      });
      var arr = null;

      if (keepProcessorIfEmpty != undefined && keepProcessorIfEmpty == true) {
        arr = processorArray;
      }
      else {
        arr = validProcessors;
      }
      // sort it
      return _.sortBy(arr, 'sortIndex');

    },
    /**
     * Setup the inputProcessor and nonInputProcessor and their properties on the registeredTemplate object
     * used in Feed creation and feed details to render the nifi input fields
     * @param template
     */
    initializeProperties: function (template, mode, feedProperties) {
      //get the saved properties

      var savedProperties = {};
      if (feedProperties) {
        _.each(feedProperties, function (property) {
          if (property.userEditable && property.templateProperty) {
            savedProperties[property.templateProperty.idKey] = property;
          }
        });
      }

      function setRenderTemplateForProcessor(processor) {
        if (processor.feedPropertiesUrl == undefined) {
          processor.feedPropertiesUrl = null;
        }
        if (processor.feedPropertiesUrl == null) {
          processor.feedPropertiesUrl = FeedInputProcessorOptionsFactory.templateForProcessor(processor, mode);

        }
      }

      function updateProperties(processor, properties) {

        _.each(properties, function (property) {
          //set the value if its saved
          if (savedProperties[property.idKey] != undefined) {
            property.value == savedProperties[property.idKey]
          }
          //mark as not selected
          property.selected = false;

          property.value = data.deriveExpression(property.value, false);
          property.renderWithCodeMirror = data.isRenderPropertyWithCodeMirror(property);

          //if it is a custom render property then dont allow the default editing.
          //the other fields are coded to look for these specific properties
          //otherwise check to see if it is editable
          if (data.isCustomPropertyRendering(property.key)) {
            property.customProperty = true;
            property.userEditable = false;
          } else if (property.userEditable == true) {
            processor.userEditable = true;
          }
          property.displayValue = property.value;
          if (property.key == "Source Database Connection" && property.propertyDescriptor != undefined && property.propertyDescriptor.allowableValues) {
            var descriptorOption = _.find(property.propertyDescriptor.allowableValues, function (option) {
              return option.value == property.value;
            });
            if (descriptorOption != undefined && descriptorOption != null) {
              property.displayValue = descriptorOption.displayName;
            }
          }

        })

      }

      _.each(template.inputProcessors, function (processor) {
        //ensure the processorId attr is set
        processor.processorId = processor.id
        updateProperties(processor, processor.properties)
        setRenderTemplateForProcessor(processor);
      });
      _.each(template.nonInputProcessors, function (processor) {
        //ensure the processorId attr is set
        processor.processorId = processor.id
        updateProperties(processor, processor.properties)
        setRenderTemplateForProcessor(processor);
      });

    },
    disableTemplate:function(templateId){
      var self = this;
      var promise = $http.post(RestUrlService.DISABLE_REGISTERED_TEMPLATE_URL(templateId)).then(function(response){
        self.model.state = response.data.state
        if ( self.model.state == 'ENABLED') {
          self.model.stateIcon = 'check_circle'
        }
        else {
          self.model.stateIcon = 'block'
        }
      });
      return promise;
    },
    /**
     *
     * @param templateId
     * @returns {*}
     */
    enableTemplate:function(templateId){
      var self = this;
      var promise = $http.post(RestUrlService.ENABLE_REGISTERED_TEMPLATE_URL(templateId)).then(function(response){
        self.model.state = response.data.state
        if ( self.model.state == 'ENABLED') {
          self.model.stateIcon = 'check_circle'
        }
        else {
          self.model.stateIcon = 'block'
        }
      });
      return promise;

    },
    deleteTemplate:function(templateId){
      var deferred = $q.defer();
       $http.delete(RestUrlService.DELETE_REGISTERED_TEMPLATE_URL(templateId)).then(function(response){
        deferred.resolve(response);
      }, function(response){
        deferred.reject(response);
      });
      return deferred.promise;
    },
    getTemplateProcessorDatasourceDefinitions : function(nifiTemplateId, inputPortIds){
      var deferred = $q.defer();
      $http.get(RestUrlService.TEMPLATE_PROCESSOR_DATASOURCE_DEFINITIONS(nifiTemplateId),{params:{inputPorts:inputPortIds}}).then(function(response){
        deferred.resolve(response);
      }, function(response){
        deferred.reject(response);
      });
      return deferred.promise;

    },
    /**
     * Assigns the model properties and render types
     * Returns a promise
     * @returns {*}
     */
    loadTemplateWithProperties:function(registeredTemplateId, nifiTemplateId){
      var isValid = true;

      var self = this;
      /**
       * Assign the render types to the properties
       * @param property
       */
      function assignPropertyRenderType(property) {

        var allowableValues = property.propertyDescriptor.allowableValues;
        if( allowableValues !== undefined && allowableValues !== null && allowableValues.length >0 ){
          if(allowableValues.length == 2){
            var list = _.filter(allowableValues,function(value){
              return (value.value.toLowerCase() == 'false' ||  value.value.toLowerCase() == 'true');
            });
            if(list != undefined && list.length == 2) {
              property.renderTypes = self.trueFalseRenderTypes;
            }
          }
          if(property.renderTypes == undefined){
            property.renderTypes = self.selectRenderType;
          }
          property.renderType = property.renderType == undefined ? 'select' : property.renderType;
        }
        else {
          property.renderTypes = self.propertyRenderTypes;
          property.renderType = property.renderType == undefined ? 'text' : property.renderType;
        }
      }

      /**
       * groups properties into processor groups
       * TODO fix to reference Java collections instead of in Javascript
       * @param properties
       */
      function transformPropertiesToArray(properties) {
        var inputProperties = [];
        var additionalProperties = [];
        var inputProcessors  = [];
        var additionalProcessors = [];
        angular.forEach(properties, function (property, i) {
          if(property.processor == undefined){
            property.processor = {};
            property.processor.id = property.processorId;
            property.processor.name = property.processorName;
            property.processor.type = property.processorType;
            property.processor.groupId = property.processGroupId;
            property.processor.groupName = property.processGroupName;
          }

          if(property.selected == undefined){
            property.selected = false;
          }
          if(property.renderOptions == undefined){
            property.renderOptions = {};
          }
          // if(property.propertyDescriptor.required == true && ( property.value =='' || property.value ==undefined)) {
          //     property.selected = true;
          //  }

          assignPropertyRenderType(property)

          property.templateValue = property.value;
          property.userEditable = (property.userEditable == undefined || property.userEditable == null) ? true : property.userEditable ;

          if(property.inputProperty){
            property.mentioId='inputProperty'+property.processorName+'_'+i;
          }
          else {
            property.mentioId='processorProperty_'+property.processorName+'_'+i;
          }

          //       copyProperty.processor = {id: property.processor.id, name: property.processor.name};
          if(property.inputProperty) {
            inputProperties.push(property);
          }
          else {
            additionalProperties.push(property);
          }
        });

        //sort them by processor name and property key
        var inputPropertiesAndProcessors = self.sortPropertiesForDisplay(inputProperties);
        inputProperties = inputPropertiesAndProcessors.properties;
        inputProcessors = inputPropertiesAndProcessors.processors;

        var additionalPropertiesAndProcessors = self.sortPropertiesForDisplay(additionalProperties);
        additionalProperties = additionalPropertiesAndProcessors.properties;
        additionalProcessors = additionalPropertiesAndProcessors.processors;

        self.model.inputProperties = inputProperties;
        self.model.additionalProperties = additionalProperties;
        self.model.inputProcessors = inputProcessors;
        self.model.additionalProcessors = additionalProcessors;

      }

      function validate() {
        if (self.model.reusableTemplate) {
          self.model.valid = false;
          var errorMessage =
              "This is a reusable template and cannot be registered as it starts with an input port.  You need to create and register a template that has output ports that connect to this template";
          $mdDialog.show(
              $mdDialog.alert()
                  .ariaLabel("Error loading the template")
                  .clickOutsideToClose(true)
                  .htmlContent(errorMessage)
                  .ok("Got it!")
                  .parent(document.body)
                  .title("Error loading the template"));
          return false;
        }
        else {
          self.model.valid = true;
          return true;
        }
      }


      if(registeredTemplateId != null) {
        self.resetModel();
        //get the templateId for the registeredTemplateId
        self.model.id = registeredTemplateId;
      }
      if(nifiTemplateId != null) {
        self.model.nifiTemplateId = nifiTemplateId;
      }
      if(self.model.nifiTemplateId != null) {
        self.model.loading = true;
          var successFn = function (response) {
            var templateData = response.data;
            transformPropertiesToArray(templateData.properties);
            self.model.exportUrl = RestUrlService.ADMIN_EXPORT_TEMPLATE_URL + "/" + templateData.id;
            self.model.nifiTemplateId = templateData.nifiTemplateId;
            self.nifiTemplateId = templateData.nifiTemplateId;
            self.model.templateName = templateData.templateName;
            self.model.defineTable = templateData.defineTable;
            self.model.state = templateData.state;
            self.model.id = templateData.id;
            if(self.model.id == null){
              self.model.state = 'NOT REGISTERED'
            }
            self.model.updateDate = templateData.updateDate;
            self.model.feedsCount = templateData.feedsCount;
            self.model.allowPreconditions = templateData.allowPreconditions;
            self.model.dataTransformation = templateData.dataTransformation;
            self.model.description = templateData.description;

            self.model.icon.title = templateData.icon;
            self.model.icon.color = templateData.iconColor;
            self.model.reusableTemplate = templateData.reusableTemplate;
            self.model.reusableTemplateConnections = templateData.reusableTemplateConnections;
            self.model.needsReusableTemplate = templateData.reusableTemplateConnections != undefined && templateData.reusableTemplateConnections.length>0;
            self.model.registeredDatasourceDefinitions = templateData.registeredDatasourceDefinitions;
            if (templateData.state == 'ENABLED') {
              self.model.stateIcon = 'check_circle'
            }
            else {
              self.model.stateIcon = 'block'
            }
            validate();
            self.model.loading = false;
          }
          var errorFn = function (err) {
            self.model.loading = false;
          }
          var id = registeredTemplateId != undefined && registeredTemplateId != null ? registeredTemplateId : self.model.nifiTemplateId;
          var promise = $http.get(RestUrlService.GET_REGISTERED_TEMPLATE_URL(id), {params: {allProperties: true}});
          promise.then(successFn, errorFn);
          return promise;
        }
        else {
          var deferred = $q.defer();
          self.properties = [];
          deferred.resolve(self.properties);
          return deferred.promise;
        }




    }

  };
  data.init();
  return data;

});