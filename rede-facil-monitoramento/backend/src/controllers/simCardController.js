const service = require('../services/simCardService');


exports.listSimCards = async (req, res) => res.json(await service.listSimCards());
exports.createSimCard = async (req, res) => res.json(await service.createSimCard(req.body));
exports.updateSimCard = async (req, res) => res.json(await service.updateSimCard(req.params.id, req.body));
exports.deleteSimCard = async (req, res) => res.json(await service.deleteSimCard(req.params.id));

exports.listDevices = async (req, res) => res.json(await service.listDevices());
exports.getDeviceLogs = async (req, res) => res.json(await service.getDeviceLogs(req.params.id)); 
exports.createDevice = async (req, res) => res.json(await service.createDevice(req.body));
exports.deleteDevice = async (req, res) => res.json(await service.deleteDevice(req.params.id));

exports.listEmployees = async (req, res) => res.json(await service.listEmployees());
exports.createEmployee = async (req, res) => res.json(await service.createEmployee(req.body));
exports.updateEmployee = async (req, res) => res.json(await service.updateEmployee(req.params.id, req.body));
exports.deleteEmployee = async (req, res) => res.json(await service.deleteEmployee(req.params.id));