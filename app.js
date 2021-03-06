var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
var browser_detector = require('browser-detect');
var errno = require('./util/ch_err');
var group_access_status = require('./define/ch_group_access');
var util = require('util');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var img_pool_router = require('./routes/img_pool');
var login_router = require('./routes/login_proc');
var admin_router = require('./routes/admin_page');
var receive_broadcast_router = require('./routes/receive_broadcast');
var user_router = require('./routes/user_page');
var reg_user_router = require('./routes/reg_proc');
var group_router = require('./routes/group_page');
//var Logger = require('log4js');
var browser_detector = require('browser-detect');
var sleep = require('system-sleep');

/*Logger.configure(
{
  appenders: [
    					{ 
    						type: 'console' 
    					},
    					{
      					type: 'file',
      					filename: 'logs/access.log', 
      					maxLogSize: 1024,
      					backups:3,
    						category: 'normal' 
    					}
  					],
  replaceConsole: true
}
);*/

//global.LogPrint = Logger.getLogger('normal');

var session = require('express-session');

//starting log
//LogPrint.info("Server initial begin!");

global.path = require('path');

//database setup
global.mysql = require('mysql');
global.conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    port:3306
});

conn.connect(function(err) {
  if (err) throw err;
  conn.query("USE nkust_db;", function (err, result) {
    if (err)
    {
    	//LogPrint.info("Connect database failed!!");
    }
    else ;
    	//LogPrint.info("Database already connecting!!");
  })
});


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser('NKUST_SS_COOKIE'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ cookieName: 'session', secret: 'NKUST_SECRET', cookie: {}}));
 

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/img',img_pool_router);
app.use('/login_proc',login_router);
app.use('/admin_page',admin_router);
app.use('/receive_broadcast',receive_broadcast_router);
app.use('/user_page',user_router);
app.use('/reg_proc',reg_user_router);
app.use('/group_page',group_router);

// catch 404 and forward to error handler
app.use(function(req, res ,next) {
	
	var user_agent = browser_detector(req.headers['user-agent']);
	
	if(user_agent.name)
	{
		//is browser
		req.session.main_errcode = CH_ERROR_INVALID_PATH;
		var err_obj = {errmsg : null ,errdetail : null};
		errno.GetErrorInfo(req.session.main_errcode ,err_obj ,true);
		req.session.main_errmsg = err_obj.errmsg;
		req.session.main_errdetail = err_obj.errdetail;
			
			console.log("catch err404");
		res.status(404).sendFile(path.join(__dirname, './public', 'error_page.html'));
	}
	else
	{
		res.status(404).json({errcode : CH_ERROR_INVALID_PATH ,msg : "Invalid path"});
	}
});

// error handler
app.use(function(err, req, res, next) {
	req.connection.on('close',function(){    
       console.log("lost one connection");
    });
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.listen(80);
module.exports = app;
