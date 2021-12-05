// source: RpcConfig.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {missingRequire} reports error on implicit type usages.
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

goog.exportSymbol('proto.Acorle.Models.RpcConfigProto', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.Acorle.Models.RpcConfigProto = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.Acorle.Models.RpcConfigProto, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.Acorle.Models.RpcConfigProto.displayName = 'proto.Acorle.Models.RpcConfigProto';
}



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.Acorle.Models.RpcConfigProto.prototype.toObject = function(opt_includeInstance) {
  return proto.Acorle.Models.RpcConfigProto.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.Acorle.Models.RpcConfigProto} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.Acorle.Models.RpcConfigProto.toObject = function(includeInstance, msg) {
  var f, obj = {
    zone: jspb.Message.getFieldWithDefault(msg, 1, ""),
    key: jspb.Message.getFieldWithDefault(msg, 2, ""),
    hash: jspb.Message.getFieldWithDefault(msg, 3, ""),
    context: jspb.Message.getFieldWithDefault(msg, 4, ""),
    lastmodifiedtimestamp: jspb.Message.getFieldWithDefault(msg, 5, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.Acorle.Models.RpcConfigProto}
 */
proto.Acorle.Models.RpcConfigProto.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.Acorle.Models.RpcConfigProto;
  return proto.Acorle.Models.RpcConfigProto.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.Acorle.Models.RpcConfigProto} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.Acorle.Models.RpcConfigProto}
 */
proto.Acorle.Models.RpcConfigProto.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setZone(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.setKey(value);
      break;
    case 3:
      var value = /** @type {string} */ (reader.readString());
      msg.setHash(value);
      break;
    case 4:
      var value = /** @type {string} */ (reader.readString());
      msg.setContext(value);
      break;
    case 5:
      var value = /** @type {number} */ (reader.readInt64());
      msg.setLastmodifiedtimestamp(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.Acorle.Models.RpcConfigProto.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.Acorle.Models.RpcConfigProto.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.Acorle.Models.RpcConfigProto} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.Acorle.Models.RpcConfigProto.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getZone();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getKey();
  if (f.length > 0) {
    writer.writeString(
      2,
      f
    );
  }
  f = message.getHash();
  if (f.length > 0) {
    writer.writeString(
      3,
      f
    );
  }
  f = message.getContext();
  if (f.length > 0) {
    writer.writeString(
      4,
      f
    );
  }
  f = message.getLastmodifiedtimestamp();
  if (f !== 0) {
    writer.writeInt64(
      5,
      f
    );
  }
};


/**
 * optional string zone = 1;
 * @return {string}
 */
proto.Acorle.Models.RpcConfigProto.prototype.getZone = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/**
 * @param {string} value
 * @return {!proto.Acorle.Models.RpcConfigProto} returns this
 */
proto.Acorle.Models.RpcConfigProto.prototype.setZone = function(value) {
  return jspb.Message.setProto3StringField(this, 1, value);
};


/**
 * optional string key = 2;
 * @return {string}
 */
proto.Acorle.Models.RpcConfigProto.prototype.getKey = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 2, ""));
};


/**
 * @param {string} value
 * @return {!proto.Acorle.Models.RpcConfigProto} returns this
 */
proto.Acorle.Models.RpcConfigProto.prototype.setKey = function(value) {
  return jspb.Message.setProto3StringField(this, 2, value);
};


/**
 * optional string hash = 3;
 * @return {string}
 */
proto.Acorle.Models.RpcConfigProto.prototype.getHash = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * @param {string} value
 * @return {!proto.Acorle.Models.RpcConfigProto} returns this
 */
proto.Acorle.Models.RpcConfigProto.prototype.setHash = function(value) {
  return jspb.Message.setProto3StringField(this, 3, value);
};


/**
 * optional string context = 4;
 * @return {string}
 */
proto.Acorle.Models.RpcConfigProto.prototype.getContext = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 4, ""));
};


/**
 * @param {string} value
 * @return {!proto.Acorle.Models.RpcConfigProto} returns this
 */
proto.Acorle.Models.RpcConfigProto.prototype.setContext = function(value) {
  return jspb.Message.setProto3StringField(this, 4, value);
};


/**
 * optional int64 lastModifiedTimestamp = 5;
 * @return {number}
 */
proto.Acorle.Models.RpcConfigProto.prototype.getLastmodifiedtimestamp = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 5, 0));
};


/**
 * @param {number} value
 * @return {!proto.Acorle.Models.RpcConfigProto} returns this
 */
proto.Acorle.Models.RpcConfigProto.prototype.setLastmodifiedtimestamp = function(value) {
  return jspb.Message.setProto3IntField(this, 5, value);
};


goog.object.extend(exports, proto.Acorle.Models);