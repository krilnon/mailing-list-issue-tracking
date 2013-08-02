var 
	data,
	lists = {
		'tech': [
			'Zhandos Y. Orazalin <orazalin@mit.edu>',
			'Kyle Ian Murray <kimurray@mit.edu>',
			'Ming Liu <mingliu@mit.edu>',
			'Itai Stein <iys@mit.edu>'
		],
		
		ahec: [
			'Jonas Helfer <helfer@mit.edu>',
			'Jordan Romvary <jromvary@mit.edu>',
			'Evelina Polyzoeva <epolyzoe@mit.edu>',
			'Misha Sra <sra@mit.edu>',
			'Shabnam Raayai Ardakani <shraayai@mit.edu>'
		],
		
		athletics: [
			'Nadim Walid Chakroun <nwc@mit.edu>',
		]
	},
	listCache = {},
	threadMax = 3

init()

function init(){
	$.ajax({
		url: 'json/',
		dataType: 'text',
		success: onJSON,
		error: onJSONError
	})
}

function onJSON(str){
	"use strict"
	data = eval('[' + str + ']') // intentionally using eval to deal with trailing commas.  JSON standard is silly.
	data = thread(data)
	$('body').append(render(data))
}

function onJSONError(err){
	// too bad
	console.log(arguments)
}

function canonicalize(subject){
	var s = subject.toLowerCase()
	s = s.replace(/^((re|fwd):\s*)+/g, '')
	s = s.trim()
	return s
}

function isOP(nameEmail, thread){
	try {
		var nameRes = nameCanon(nameEmail)
		var threadRes = nameCanon(thread[0].from)
		return nameRes.name == threadRes.name || nameRes.email == threadRes.email
	} catch(err){
		return false // `nameCanon` could easily have errors, but it's not important for IDing OP
	}
}

function listMembership(nameEmail){
	if(nameEmail in listCache) return listCache[nameEmail]
	for(var listName in lists){
		var list = lists[listName]
		for(var i in list){
			var member = list[i].replace(/(\w\w\w)(\w+)/g, function(m){ return m.substring(0, 3) + (new Array(m.length - 2).join('*')) })
			
			var memberRes = nameCanon(member)
			var nameRes = nameCanon(nameEmail)
			
			if(nameRes.name == memberRes.name || nameRes.email == memberRes.email){
				listCache[nameEmail] = listName
				return listName
			}
		}
	}
	
	return false
}

function isTech(nameEmail){
	return listMembership(nameEmail == 'ashdown-tech')
}

function nameCanon(nameEmail){
	nameEmail = nameEmail.toLowerCase()
	var parts = nameEmail.split('<')
	var name = parts[0].trim().split(/"|'|\.|,/).join('')
	var email = parts[1].trim()
	
	var nameParts = name.split(/\s/)
	var fName = nameParts[0]
	var lName = nameParts[1]
	
	email = email.split('>').join('').trim()
	
	return {
		name: fName + lName,
		email: email
	}
}

function sameName(from1, from2){
	var res1 = nameCanon(from1)
	var res2 = nameCanon(from2)
	return res1.name == res2.name || res1.email == res2.email
}

function thread(d){
	var map = {}
	for(var i = 0; i < d.length; i++){
		var message = d[i]
		message.subject = window.atob(message.subject)
		message.cSubject = canonicalize(message.subject)
		message.from = window.atob(message.from).replace('MIT.EDU', 'mit.edu')
		message.date = new Date(message.date).getTime()
		
		if(message.cSubject in map){
			map[message.cSubject].push(message)
		} else {
			map[message.cSubject] = [message]
		}
	}
	
	for(var key in map){
		var thread = map[key]
		thread.sort(function(a, b){
			return a.date - b.date
		})
	}
	
	var threads = []
	for(key in map){
		threads.push(map[key])
	}
	threads.sort(function(a, b){
		return a[a.length - 1].date - b[b.length - 1].date
	})
	
	// determine more information about the thread
	// this info needs the thread to be sorted by time, so it's done later
	for(i = 0; i < threads.length; i++){
		var t = threads[i]
		for(var j = 0; j < t.length; j++){
			var m = t[j]
			if(j > 0){
				m.duration = m.date - t[j - 1].date
				m.prev = t[j - i]
			}
			if(j == 0) m.first = true
			if(j == t.length - 1) m.last = true
		}
	}
	
	return threads.reverse()
}

function render(threads){
	var $threadContainer = $('<div />', { id: 'thread-container' })
	for(var i = 0; i < threads.length; i++){
		var $thread = renderThread(threads[i])
		$threadContainer.append($thread)
	}
	return $threadContainer
}

function renderThread(thread, options){
	options = options || {
		displayName: true,
		displayDate: true
	}
	var oe = thread[0]
	var op = oe.from
	
	var $thread =  $('<div />', { class: 'thread' })
	
	$thread.append($('<span />', {
		class: 'subject',
		text: oe.subject
	}))
	
	$thread.append($('<br />'))
	$thread.append($('<span />', {
		class: 'date',
		text: '(last active '  + moment(thread[thread.length - 1].date).fromNow() + ')'
	}))
	
	var $emailList = $('<ul />', { class: 'email-list' })
	$thread.append($emailList)

	for(var i = 0; i < thread.length; i++){
		if(!options.expand && i == threadMax && thread.length > threadMax * 2){
			
			var expandThread = function(){
				var target = arguments.callee.target
				for(var i = 0; i < target.thread.length; i++){
					var message = target.thread[i]
					target.options.isOP = isOP(message.from, thread)
					var $message = renderMessage(message, target.options, target.thread[0].from)
					target.replace.after($message)
					$message.before(
						renderDuration(message, $message)
					)
				}
				target.replace.remove()
			}
			
			var $expandBtn = $('<div />', { 
				class: 'expand-btn'
			}).click(expandThread)
			
			$expandBtn.append('expand all (' + (thread.length - 2 * threadMax) + ' more)').show()
			$expandBtn.append($('<p />', { class: 'arrow', text: '↓' }))
			
			var optionsExpanded = JSON.parse(JSON.stringify(options))
			optionsExpanded.expand = true
			
			expandThread.target = {
				thread: thread.slice(threadMax, thread.length - threadMax),
				replace: $expandBtn,
				options: optionsExpanded
			}
			
			var li = $('<li />')
			li.append($expandBtn)
			
			$emailList.append(li)
		}
		
		var message = thread[i]
		options.isOP = isOP(message.from, thread)
		var $message = renderMessage(message, options)
		var noMessage = false
		
		if(!options.expand && (thread.length > threadMax * 2) && (i >= threadMax && i < thread.length - threadMax)){ // collapse zone
			noMessage = true
		} else {
			$emailList.append($message)	
		}
		
		$message.before(renderDuration(message, $message))
				
		if(message.last && message.from == op){
			$emailList.append($('<li />', {
				class: 'duration',
				text: moment.duration((new Date).getTime() - message.date, 'milliseconds').humanize() + '  passed without a response!'
			}))
		}
	}
	return $thread
}

function renderDuration(message, $message){
	if(message.duration){
		return $('<li />', {
			class: 'duration',
			text: moment.duration(message.duration, 'milliseconds').humanize() + ' later…'
		})
	}
}

function renderMessage(message, options){
	options = options || options
	
	var text = ''
	
	if(options.displayName) text = message.from
	
	var $message = $('<li />', { class: 'message' })
	
	if(options.isOP){
		$message.append($('<span />', { 
			text: '[thread starter] ',
			class: 'op'
		}))
	}
	
	var listMember = listMembership(message.from)
	if(listMember){
		$message.append($('<span />', { 
			text: '[' + listMember + '] ',
			class: 'list-name'
		}))
	}
	
	$message.append($('<span />', { text: text }))
	
	return $message
}