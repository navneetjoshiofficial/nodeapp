'use strict';
const Hapi = require('hapi');
const server = new Hapi.Server();
const fetch = require('node-fetch');
const ngeohash = require('ngeohash');
const utils = require('./utils');
const Pusher = require('pusher');
const pusher = new Pusher({
    //appId: '473907',
    //key: '04796c3a75342b0869d8',
    //secret: '70ee1f71b9ca756b1e94',
    //cluster: 'us2',
    appId: '473989',
    key: '23ae8317a9be31c933fd',
    secret: 'b44d1ac9dd7cbd47cc1c',
    cluster: 'ap2',
  encrypted: true
});

// List of channels that have users subscribed to

var fs = require('fs');


server.connection({
   host: 'localhost',
  //  tls: tls,
    port: process.env.PORT || 8000
});
let channels = new Set();
console.log(channels);
server.register([require('inert'), require('vision')], (err) => {
  if (err) {
    throw err;
  }

  server.views({
    engines: {
      html: require('handlebars')
    },
    context: {
        mapboxAccessToken:"pk.eyJ1IjoiYWVtYmFyayIsImEiOiJjamRobHlyMWEweHE3MnhwZ3pwdGpmamtwIn0.EGnHY0Z428UUyPR4tGrFvQ",
        pusherAccessToken: "23ae8317a9be31c933fd",
        pusherCluster: "ap2"
    },
    relativeTo: __dirname,
    path: 'templates'
  });
  
  server.route({
    method: 'POST',
    path:'/channelhook',
    handler: function (request, reply) {
       
        console.log(request);
      const webhook = pusher.webhook({
        rawBody: JSON.stringify(request.payload),
        headers: request.headers
      });

      if (!webhook.isValid()) {
          
        console.log('Invalid webhook')
        return reply(400);
      } else {
        reply(200);
      }

      webhook.getEvents().forEach(e => {
          //debugger;
        if(e.name == 'channel_occupied') {
          channels.add(e.channel)
        }
        if(e.name == 'channel_vacated') {
          channels.delete(e.channel)
        }
      });
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply.view('index');
    }
  });

  // Static resources
  server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
      directory: {
        path: 'public'
      }
    }
  });

});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);

  function nextEncounter() {
      //debugger;
    const channelArray = Array.from(channels);
    const bounds = channelArray[Math.floor(Math.random()*channelArray.length)];
    if(bounds) {
      const boundingBox = ngeohash.decode_bbox(bounds);
      const lngMin = boundingBox[1];
      const lngMax = boundingBox[3];
      const latMin = boundingBox[0];
      const latMax = boundingBox[2];

      const lng = utils.randomNumber(lngMin, lngMax).toFixed(10);
      const lat = utils.randomNumber(latMin, latMax).toFixed(10);
      const duration = utils.randomNumber(30, 300) * 1000;

      const pokemonId = parseInt(utils.randomNumber(1, 250), 10);
      console.log(pokemonId);
      fetch('http://pokeapi.co/api/v2/pokemon/' + pokemonId+'/')
        .then(res => {
          return res.json();
        })
        .then(pokemon => {
          const data = {
            id: pokemonId,
            name: pokemon.name,
            sprite: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + pokemonId+'.png',
            coordinates: [lng, lat],
            expires: parseInt((new Date()).getTime() + duration, 10),
            hp: pokemon.stats.find(stat => stat.stat.name === 'hp').base_stat,
            types: pokemon.types.map(type => type.type.name[0] + type.type.name.substring(1))
          }

          pusher.trigger(bounds, 'encounter', data);
        });
    }
    setTimeout(nextEncounter, 5000);
  }

  nextEncounter();
});
