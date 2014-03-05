/*************** Adapters & Serializers ****************/

ASTool.AnnotationsStore = Em.Object.extend({
	iframeBinding: 'ASTool.iframe',

	findAll: function() {
		var annotatedElements = this.get('iframe').findAnnotatedElements();
		var annotations = [];
		annotatedElements.each(function(i, element) {
			var annotationJSON = $.parseJSON($(element).attr('data-scrapy-annotate'));
			annotations.pushObject(ASTool.Annotation.create(annotationJSON));
		}.bind(this));
		return annotations;
	},

	_prepareToSave: function() {
		var ignoredElements = this.get('iframe').findIgnoredElements();
		ignoredElements.removeAttr('data-scrapy-ignore');
		ignoredElements.removeAttr('data-scrapy-ignore-beneath');
		var annotatedElements = this.get('iframe').findAnnotatedElements();
		annotatedElements.each(function(i, element) {
			$(element).attr('data-scrapy-annotate', null);
		}.bind(this));
	},

	saveAll: function(annotations) {
		this._prepareToSave();
		annotations.forEach(function(annotation) {
			annotation.get('ignores').forEach(function(ignore) {
				var ignoreJSON = {id: annotation.get('id'), name: ignore.get('name')};
				var attrName = ignore.get('ignoreBeneath') ? 'data-scrapy-ignore-beneath' : 'data-scrapy-ignore';
				$(ignore.get('element')).attr(attrName, JSON.stringify(ignoreJSON));
			});
			$(annotation.get('element')).attr('data-scrapy-annotate',
				JSON.stringify(annotation.serialize()));
		}.bind(this));
	},
});

/*************************** Models **************************/

ASTool.SimpleModel = Em.Object.extend(Em.Copyable, {
	idBinding: 'name',
	name: null,
	serializedProperties: null,
	serializedRelations: null,

	copy: function() {
		return Em.run(this.constructor, 'create', this);
	},

	serialize: function() {
		var serialized = this.getProperties(this.get('serializedProperties'));
		if (!Em.isEmpty(this.get('serializedRelations'))) {
			this.get('serializedRelations').forEach(function(relation) {
				serialized[relation] = this.get(relation).map(function(relatedObject) {
					return relatedObject.serialize();
				});
			}.bind(this));	
		}
		return serialized;
	},
});


ASTool.Template = ASTool.SimpleModel.extend({
	serializedProperties: ['page_id', 'default', 'scrapes',
		'page_type', 'url', 'annotated_body', 'original_body',
		'extractors', 'name'],
	page_id: '',
	scrapes: 'default',
	page_type: 'item',
	url: '',
	annotated_body: '',
	original_body: '',
	extractors: null,
}),

ASTool.Spider = ASTool.SimpleModel.extend({
	serializedProperties: ['start_urls',
		'start_urls', 'links_to_follow', 'follow_patterns',
		'exclude_patterns', 'respect_nofollow',
		'init_requests'],
	serializedRelations: ['templates'],
	start_urls: null,
	links_to_follow: 'patterns',
	follow_patterns: null,
	exclude_patterns: null,
	respect_nofollow: true,
	templates: null,
	init_requests: null,

	performLogin: function(key, performLogin) {
		if (arguments.length > 1) {
			if (performLogin) {
				this.get('init_requests').setObjects([{ type: 'login' }]);
			} else {
				this.get('init_requests').setObjects([]);
			}
		}
		return !!this.get('init_requests').length;
	}.property('init_requests'),

	loginUrl: function(key, loginUrl) {
		var reqs = this.get('init_requests');
		if (arguments.length > 1) {
			reqs[0]['loginurl'] = loginUrl;	
		}
		return reqs.length ? reqs[0]['loginurl'] : null;
	}.property('init_requests'),

	loginUser: function(key, loginUser) {
		var reqs = this.get('init_requests');
		if (arguments.length > 1) {
			reqs[0]['username'] = loginUser;	
		}
		return reqs.length ? reqs[0]['username'] : null;
	}.property('init_requests'),

	loginPassword: function(key, loginPassword) {
		var reqs = this.get('init_requests');
		if (arguments.length > 1) {
			reqs[0]['loginPassword'] = loginPassword;
		}
		return reqs.length ? reqs[0]['loginPassword'] : null;
	}.property('init_requests'),
}),

ASTool.Annotation = ASTool.SimpleModel.extend({

	init: function() {
		this._super();
		var ignoredElements = this.get('iframe').findIgnoredElements(this.get('id')).toArray();
		var ignores = ignoredElements.map(function(element) {
			var attributeName = $(element).attr('data-scrapy-ignore') ? 'data-scrapy-ignore' : 'data-scrapy-ignore-beneath';
			var name = $.parseJSON($(element).attr(attributeName))['name'];
			return ASTool.Ignore.create({element: element,
										 name: name,
										 ignoreBeneath: attributeName == 'data-scrapy-ignore-beneath'});
		});
		this.set('ignores', ignores);
	},

	idBinding: null,

	serializedProperties: ['id', 'variant', 'annotations', 'required', 'generated'],

	name: function() {
		var annotations = this.get('annotations');
		if (annotations && Object.keys(annotations).length) {
			var name = '';
			Object.keys(annotations).forEach(function(key) {
				name += (name.length ? ', ' : '') + key + '  >  ';
				name += annotations[key];
			});
			return name;
		} else {
			return 'Empty (' + this.get('id').substring(0, 5) + ')';
		}
	}.property('annotations'),

	variant: 0,
	
	annotations: null,

	required: false,

	generated: false,

	ignores: null,

	iframeBinding: 'ASTool.iframe',
	
	addMapping: function(attribute, itemField) {
		this.get('annotations')[attribute] = itemField;
		this.notifyPropertyChange('annotations');
	},
	
	removeMapping: function(attribute) {
		this.removeRequired(this.get('annotations')[attribute]);
		delete this.get('annotations')[attribute];
		this.notifyPropertyChange('annotations');
	},

	removeMappings: function() {
		this.set('annotations', {});
		this.set('required', []);
		this.notifyPropertyChange('annotations');
	},

	addRequired: function(field) {
		this.get('required').pushObject(field);
	},

	removeRequired: function(field) {
		this.get('required').removeObject(field);
	},

	addIgnore: function(element) {
		var ignore = ASTool.Ignore.create({element: element});
		this.get('ignores').pushObject(ignore);
	},

	removeIgnore: function(ignore) {
		this.get('ignores').removeObject(ignore);
	},

	removeIgnores: function() {
		this.get('ignores').setObjects([]);
	},

	partialText: function() {
		if (this.get('element') && this.get('generated')) {
			return $(this.get('element')).text();
		} else {
			return '';
		}
	}.property('element'),
		
	selectedElement: null,
	
	element: function() {
		if (this.get('selectedElement')) {
			return this.get('selectedElement');
		} else {
			var annotatedElement = this.get('iframe').findAnnotatedElement(this.get('id'));
			if (annotatedElement.length) {
				return annotatedElement.get(0);
			} else {
				return null;
			}
		}
	}.property('selectedElement'),

	path: function() {
		if (this.get('element')) {
			return $(this.get('element')).getUniquePath();
		} else {
			return '';
		}
	}.property('element'),

	ancestorPaths: function() {
		if (!this.get('element')) {
			return [];
		}
		var path = this.get('path');
		var splitted = path.split('>');
		var result = [];
		var selector = '';
		splitted.forEach(function(pathElement, i) {
			var ancestorPath = {};
			selector += (selector ? '>' : '') + pathElement;
			ancestorPath['path'] = selector;
			var element = this.get('iframe').find(selector).get(0);
			ancestorPath['element'] = element;
			ancestorPath['label'] = element.tagName.toLowerCase();
			result.pushObject(ancestorPath);
		}.bind(this));
		return result;
	}.property('path'),

	childPaths: function() {
		if (!this.get('element')) {
			return [];
		}
		var result = [];
		if (this.get('element')) {
			var path = this.get('path');
			var children = this.get('element').children;
			children = Array.prototype.slice.call(children);
			children.forEach(function(child, i) {
				var childPath = {};
				childPath['label'] = child.tagName.toLowerCase();
				childPath['path'] = path + '>' + ':eq(' + i + ')';
				childPath['element'] = child;
				result.pushObject(childPath);
			});
		}
		return result;
	}.property('path'),
	
	attributes: function() {
		if (this.get('element')) {
			return $(this.get('element')).getAttributeList();
		} else {
			return [];
		}
	}.property('element'),
	
	unmappedAttributes: function() {
		unmapped = this.get('attributes').filter(
			function(attribute, index, self) {
				return !this.get('annotations')[attribute.get('name')];
			}.bind(this));
		return unmapped;
	}.property('attributes.@each', 'annotations'),
	
	_mappedAttributes: function(filter) {
		mapped = [];
		if (this.get('annotations')) {
			this.get('attributes').forEach(function(attribute) {
				var mappedTo = this.get('annotations')[attribute.get('name')];
				if (filter(mappedTo)) {
					attribute.set('mappedField', mappedTo);
					mapped.addObject(attribute);
				}
			}.bind(this));	
		}
		return mapped;
	},

	mappedAttributes: function() {
		return this._mappedAttributes(function(fieldName) {
			return fieldName && fieldName.indexOf('_sticky') != 0;
		});
	}.property('attributes.@each', 'annotations'),

	stickyAttributes: function() {
		return this._mappedAttributes(function(fieldName) {
			return fieldName && fieldName.indexOf('_sticky') == 0;
		});
	}.property('attributes.@each', 'annotations'),
});


ASTool.Item = ASTool.SimpleModel.extend({
	serializedRelations: ['fields'],
	serializedProperties: ['name'],
	fields: null,
});


ASTool.ItemField = ASTool.SimpleModel.extend({
	serializedProperties: ['name', 'type', 'required', 'vary'],
	type: 'text',
	required: false,
	vary: false,
});


ASTool.Attribute = ASTool.SimpleModel.extend({
	value: null,
	mappedField: null,
	annotation: null,
});


ASTool.Ignore = ASTool.SimpleModel.extend({
	element: null,
	ignoreBeneath: false,
	highlighted: false,
});


ASTool.Extractor = ASTool.SimpleModel.extend({
	regular_expression: null,
	type_extractor: null,
});
