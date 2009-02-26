/* 
Script: Namespace.js
	Namespace utility

Copyright:
	Copyright (c) 2009 Maxime Bouroumeau-Fuseau

License:
	MIT-style license.
	
Version:
	1.0
*/
var Namespace = (function() {

	var _listeners = {};
	var _includedIdentifiers = [];
	var _isIE = navigator.userAgent.indexOf('MSIE') != -1;
	var _isOpera = window.opera ? true : false;
	
	/**
	 * Returns an object in an array unless the object is an array
	 *
	 * @param	mixed	obj
	 * @return	Array
	 */
	var _toArray = function(obj) {
		// checks if it's an array
		if (typeof(obj) == 'object' && obj.sort) {
			return obj;
		}
		return new Array(obj);
	};
	
	/**
	 *
	 */
	var _createXmlHttpRequest = function() {
		var xhr;
		try { xhr = new XMLHttpRequest() } catch(e) {
			try { xhr = new ActiveXObject("Msxml2.XMLHTTP.6.0") } catch(e) {
				try { xhr = new ActiveXObject("Msxml2.XMLHTTP.3.0") } catch(e) {
					try { xhr = new ActiveXObject("Msxml2.XMLHTTP") } catch(e) {
						try { xhr = new ActiveXObject("Microsoft.XMLHTTP") } catch(e) {
							throw new Error( "This browser does not support XMLHttpRequest." )
						}
					}
				}
			}
		}
		return xhr;
	};
	
	/**
	 * Checks if an http request is successful based on its status code.
	 * Borrowed from dojo (http://www.dojotoolkit.org).
	 *
	 * @param	Integer	status 	Http status code
	 * @return	Boolean
	 */
	var _isHttpRequestSuccessful = function(status) {
		return (status >= 200 && status < 300) || 	// Boolean
				status == 304 || 						// allow any 2XX response code
				status == 1223 || 						// get it out of the cache
				(!status && (location.protocol == "file:" || location.protocol == "chrome:") ); // Internet Explorer mangled the status code
	};
	
	/**
	 *
	 */
	var _createScript = function(data) {
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.text = data;
		document.body.appendChild(script);
	};
	
	/**
	 *
	 */
	var _loadScript = function(uri) {
		var successCallback = arguments[1] || false;
		var errorCallback = arguments[2] || false;
		var async = successCallback != false;
		var event = { 'uri': uri, 'async': async, 'callback': successCallback };
		
		var xhr = _createXmlHttpRequest();
		xhr.open("GET", uri, async);

		if (async) {
			xhr.onreadystatechange = function() {
				if (xhr.readyState == 4) {
					if (_isHttpRequestSuccessful(xhr.status || 0)) {
						_createScript(xhr.responseText);
						successCallback();
						return;
					}
					event.status = xhr.status;
					_dispatchEvent('includeError', event);
					errorCallback && errorCallback();
				}
			};
		}
		
		xhr.send(null);
		
		if (!async) {
			if (_isHttpRequestSuccessful(xhr.status || 0)) {
				_createScript(xhr.responseText);
				return true;
			}
			event.status = xhr.status;
			_dispatchEvent('includeError', event);
			return false;
		}
	};
	
	/**
	 * Dispatches an event
	 *
	 * @param	String	eventName
	 * @param	Object	properties
	 */
	var _dispatchEvent = function(eventName, properties) {
		if (!_listeners[eventName]) return;
		properties.event = eventName;
		for (var i = 0; i < _listeners[eventName].length; i++) {
			_listeners[eventName][i](properties);
		}
	};
	
	/**
	 * Creates an Object following the specified namespace identifier.
	 *
	 * @public
	 * @param 	String	identifier	The namespace string
	 * @param	Object	klasses		(OPTIONAL) An object which properties will be added to the namespace
	 * @return	Object				The most inner object
	 */
	var _namespace = function(identifier) {
		var klasses = arguments[1] || false;
		var ns = window;
		
		if (identifier != '') {
			var parts = identifier.split(Namespace.separator);
			for (var i = 0; i < parts.length; i++) {
				if (!ns[parts[i]]) {
					ns[parts[i]] = {};
				}
				ns = ns[parts[i]];
			}
		}
		
		if (klasses) {
			for (var klass in klasses) {
				ns[klass] = klasses[klass];
			}
		}
		
		_dispatchEvent('create', { 'identifier': identifier });
		return ns;
	};
	
	/**
	 * Checks if the specified identifier is defined
	 *
	 * @public
	 * @param 	String	identifier	The namespace string
	 * @return	Boolean
	 */
	_namespace.exist = function(identifier) {
		if (identifier == '') return true;
		
		var parts = identifier.split(Namespace.separator);
		var ns = window;
		for (var i = 0; i < parts.length; i++) {
			if (!ns[parts[i]]) {
				return false;
			}
			ns = ns[parts[i]];
		}
		
		return true;
	};
	
	/**
	 * Maps an identifier to a uri. Is public so it can be overriden by custom scripts.
	 *
	 * @public
	 * @param	String	identifier 	The namespace identifier
	 * @return	String				The uri
	 */
	_namespace.mapIdentifierToUri = function(identifier) {
		var regexp = new RegExp('\\' + Namespace.separator, 'g');
		return Namespace.baseUri + identifier.replace(regexp, '/') + '.js';
	};
	
	/**
	 * Includes a remote javascript file identified by the specified namespace string. The identifier
	 * must point to a class. Separators in the string will be converted to slashes and the .js extension will be appended.
	 *
	 * @public
	 * @param	String		identifier	The namespace string
	 * @param	Function	callback	(OPTIONAL) A function to call when the remote script has been included
	 */
	_namespace.include = function(identifier) {
		var successCallback = arguments[1] || false;
		var errorCallback = arguments[2] || false;
		var uri = _namespace.mapIdentifierToUri(identifier);
		
		// checks if the identifier is not already included
		if (_includedIdentifiers[identifier]) {
			successCallback && successCallback();
			return true;
		}
		
		if (successCallback) {
			_loadScript(uri, function() {
				_includedIdentifiers[identifier] = true;
				successCallback();
			}, errorCallback);
		} else {
			if (_loadScript(uri)) {
				_includedIdentifiers[identifier] = true;
				return true;
			}
			return false;
		}
	};
	
	/**
	 * Imports properties from the specified namespace to the global space (ie. under window)
	 *
	 * The identifier string can contain the * wildcard character as its last segment (eg: com.test.*) 
	 * which will unpack all properties from the namespace.
	 * 
	 * If not, the targeted namespace will be unpacked (ie. if com.test is unpacked, the test object 
	 * will now be global).
	 * If the targeted object is not found, it will be included using include().
	 *
	 * @public
	 * @param	String		identifier 	The namespace string
	 * @param	Function	callback	(OPTIONAL) A function to call when the process is completed (including the include() if used)
	 * @param	Boolean		autoInclude	(OPTIONAL) Whether to automatically auto include the targeted object is not found. Default is Namespace.autoInclude
	 */
	_namespace.use = function(identifier) {
		var identifiers 		= _toArray(identifier);
		var callback 			= arguments[1] || false;
		var autoInclude 		= arguments.length > 2 ? arguments[2] : Namespace.autoInclude;
		var event				= { 'identifier': identifier };
		
		for (var i = 0; i < identifiers.length; i++) {
			identifier = identifiers[i];
		
			var parts = identifier.split(Namespace.separator);
			var target = parts.pop();
			var ns = _namespace(parts.join(Namespace.separator));
		
			if (target == '*') {
				// imports all objects from the identifier, can't use include() in that case
				for (var objectName in ns) {
					window[objectName] = ns[objectName];
				}
			} else {
				// imports only one object
				if (ns[target]) {
					// the object exists, import it
					window[target] = ns[target];
				} else {
					// the object does not exist
					if (autoInclude) {
						// try to auto include it
						if (callback) {
							_namespace.include(identifier, function() {
								window[target] = ns[target];
							
								if (i + 1 < identifiers.length) {
									// we continue to unpack the rest from here
									_namespace.unpack(identifiers.slice(i + 1), callback, autoInclude);
								} else {
									// no more identifiers to unpack
									_dispatchEvent('unpack', event);
									callback && callback();
								}
							});
							return;
						} else {
							_namespace.include(identifier);
							window[target] = ns[target];
						}
					}
				}
			}
		
		}
		
		// all identifiers have been unpacked
		_dispatchEvent('unpack', event);
		callback && callback();
	};
	
	/**
	 * Binds the include() and unpack() method to a specified identifier
	 *
	 * @public
	 * @param	String	identifier 	The namespace identifier
	 * @return	Object
	 */
	_namespace.from = function(identifier) {
		return {
			/**
			 * Includes the identifier specified in from()
			 *
			 * @see Namespace.include()
			 */
			include: function() {
				var callback = arguments[0] || false;
				_namespace.include(identifier, callback);
			},
			/**
			 * Includes the identifier specified in from() and unpack
			 * the specified indentifier in _identifier
			 *
			 * @see Namespace.use()
			 */
			use: function(_identifier) {
				var callback = arguments[1] || false;
				if (_identifier.charAt(0) == '.') {
					_identifier = identifier + _identifier;
				}
				
				if (callback) {
					_namespace.include(identifier, function() {
						_namespace.use(_identifier, callback, false);
					});
				} else {
					_namespace.include(identifier);
					_namespace.use(_identifier, callback, false);
				}
			}
		};
	};
	
	/**
	 * Registers a function to be called when the specified event is dispatched
	 *
	 * @param	String		eventName
	 * @param	Function	callback
	 */
	_namespace.addEventListener = function(eventName, callback) {
		if (!_listeners[eventName]) _listeners[eventName] = [];
		_listeners[eventName].push(callback);
	};
	
	/**
	 * Unregisters an event listener
	 *
	 * @param	String		eventName
	 * @param	Function	callback
	 */
	_namespace.removeEventListener = function(eventName, callback) {
		if (!_listeners[eventName]) return;
		for (var i = 0; i < _listeners[eventName].length; i++) {
			if (_listeners[eventName][i] == callback) {
				delete _listeners[eventName][i];
				return;
			}
		}
	};
	
	/**
	 * Adds methods to javascript native's object
	 *
	 * @public
	 */
	_namespace.registerNativeExtensions = function() {
		/**
		 * @see Namespace()
		 */
		String.prototype.namespace = function() {
			var klasses = arguments[0] || {};
			return _namespace(this.valueOf(), klasses); 
		};
		/**
		 * @see Namespace.include()
		 */
		String.prototype.include = function() {
			var callback = arguments[0] || false;
			return _namespace.include(this.valueOf(), callback);
		}
		/**
		 * @see Namespace.unpack()
		 */
		String.prototype.use = function() {
			var callback = arguments[0] || false;
			return _namespace.use(this.valueOf(), callback);
		}
		/**
		 * @see Namespace.from()
		 */
		String.prototype.from = function() {
			return _namespace.from(this.valueOf());
		}
	};

	return _namespace;
})();

/**
 * Namespace segment separator
 *
 * @var String
 */
Namespace.separator = '.';

/**
 * Base uri when using Namespace.include()
 * Must end with a slash
 *
 * @var String
 */
Namespace.baseUri = './';

/**
 * Whether to automatically call Namespace.include() when Namespace.import() 
 * does not find the targeted object.
 *
 * @var Boolean
 */
Namespace.autoInclude = true;
	
