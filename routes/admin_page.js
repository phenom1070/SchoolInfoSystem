var express = require('express');
var ch_util = require('../util/ch_util');
var router = express.Router();
var errno = require('../util/ch_err');
var broadcast_viewer_type = ['Everyone', 'Member', 'All admin', 'Group'];
var broadcast_viewer_value_in_db = ['everyone', 'member', 'admin'];


router.get('/', function(req, res) {
	if(req.session.user_id && req.session.user_type)
	{
		if(req.session.user_type == 'admin')
			res.sendFile(path.join(__dirname, '../public', 'admin_page.html'));
		else
			res.redirect('/');
	}
	else
	{
		res.redirect('/');
	}
});
router.get('/register_admin', function(req, res) {
	if(req.session.user_id && req.session.user_type)
	{
		if(req.session.user_id == 'root' && req.session.group_name == 'root')
			res.sendFile(path.join(__dirname, '../public', 'reg_admin.html'));
		else
			res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
	}
	else
	{
		//if(req.session.client_device == 'browser')
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "Plese try to login!"});
	}
});
router.get('/broadcast', function(req, res) {
	if(req.session.user_type == 'admin')
	{
		res.sendFile(path.join(__dirname, '../public', 'broadcast.html'));
	}
	else
	{
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
	}
}
);

router.get('/get_reg_result',function(req, res){
	if(req.session.user_id == 'root' && req.session.group_name == 'root')
	{
		var ret_msg = req.session.reg_admin_msg;
		var err_code = (req.session.reg_admin_errcode) ? (req.session.reg_admin_errcode) : (CH_ERROR_SUCCESS);
		var ret_new_admin_id_remain = req.session.reg_admin_id_remain;
		var ret_group_name_remain = req.session.reg_group_name_remain;
		var ret_msg;
		delete req.session.reg_admin_msg;
		delete req.session.reg_admin_errcode;
		delete req.session.reg_admin_id_remain;
		delete req.session.reg_group_name_rename;
		res.json({errcode : err_code ,msg : ret_msg ,new_admin_id_remain : ret_new_admin_id_remain ,group_name_remain : ret_group_name_remain});
	}
	else
	{
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
	}
}
);

router.get('/get_broadcast_viewer_type',function(req, res){
	if(req.session.user_type == 'admin')
	{
		res.json({errcode : CH_ERROR_SUCCESS ,msg : null ,viewer_type : broadcast_viewer_type});
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
}
);
router.get('/get_broadcast_result',function(req, res){
	if(req.session.user_type == 'admin')
	{
		if(req.session.broadcast_result)
		{
			var result = req.session.broadcast_result;
			delete req.session.broadcast_result;
			res.json({errcode : CH_ERROR_SUCCESS ,msg : result});
		}
		else
			res.json({errcode : CH_ERROR_SUCCESS ,msg : null});
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
}
);

router.post('/send_broadcast',function(req, res){
	if(req.session.user_type == 'admin')
	{
		var viewer_select = req.body.viewer_select;
		var message = req.body.message;
		var admin_id = req.session.user_id;
		var viewer_index;
		var time_tag = ch_util.GetCurrentTimeTag();
		//res.json({viewer : viewer_select, message : message});
		delete req.session.broadcast_result;
		message = ch_util.FixStr(message);
		var cmd = null;
		for(viewer_index = 0;viewer_index < 3;viewer_index++)
		{
			if(viewer_select == broadcast_viewer_type[viewer_index])
			{
				cmd = "UPDATE broadcast SET message = '" + message + "' ,msg_sender = '" + 
							req.session.user_id + "' ,message_tag = '" + time_tag + "' WHERE viewer_type = '" + broadcast_viewer_value_in_db[viewer_index] + "'";
				break;
			}
		}
		if(viewer_index >= 3)
		{
			if(viewer_select == 'Group')
			{
				cmd = "UPDATE user_group SET group_message = '" + message + "' ,group_msg_sender = '" + 
							req.session.user_id + "' ,group_message_tag = '" + time_tag + "' WHERE group_name = '" + req.session.group_name + "'";
			}
		}
		if(cmd)
		{
			var send_broadcast = conn.query(cmd);
			
			send_broadcast.on('end' ,function(){
					if(req.session.client_device == 'browser')
					{
						req.session.broadcast_result = "Server has received your message at " + time_tag;
						res.redirect('/admin_page/broadcast');
					}
					else
					{
						res.json({errcode : CH_ERROR_SUCCESS ,msg : "Server has received your message at " + time_tag});
					}
				});
		}
		else
			res.json({errcode : CH_ERROR_INVALID_PARAM ,msg : 'Invalid parameter'});
	}
	else
	{
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
	}
}
);

router.post('/reg_admin_proc',function(req, res){
	if(req.session.user_id == 'root' && req.session.group_name == 'root')
	{
			
		var admin_id = req.body.admin_id;
		admin_id = ch_util.FixStr(admin_id);
		var group_name = req.body.group_name;
		group_name = ch_util.FixStr(group_name);
		var password = req.body.admin_password;
		password = ch_util.FixStr(password);
		var password_again = req.body.admin_password_again;
		password_again = ch_util.FixStr(password_again);
		var cmd = "SELECT * FROM users WHERE find_in_set(user_id, '" + admin_id +"')";
		var rows = [];
		var query_id = conn.query(cmd);
		query_id.on('result' ,function(row){
				if(row)
				{
					rows.push(row);
				}
			});
		query_id.on('end' ,function(){
			if(rows.length)
			{
				if(req.session.client_device == 'browser')
				{
					req.session.reg_admin_msg = 'This ID is already exist';
					req.session.reg_admin_errcode = CH_ERROR_USERID;
					req.session.reg_admin_id_remain = admin_id;
					req.session.reg_group_name_remain = group_name;
					res.redirect('/admin_page/register_admin');
				}
				else
					res.json({errcode : CH_ERROR_USERID ,msg : 'This ID is already exist'});
			}
			else
			{
				//id is correct
				if(password != password_again)
				{
					if(req.session.client_device == 'browser')
					{
						req.session.reg_admin_msg = 'Password and retype password is not same';
						req.session.reg_admin_errcode = CH_ERROR_PASSWORD;
						req.session.reg_admin_id_remain = admin_id;
						req.session.reg_group_name_remain = group_name;
						res.redirect('/admin_page/register_admin');
					}
					else
						res.json({errcode : CH_ERROR_PASSWORD ,msg : 'Password and retype password is not same'});
				}
				else
				{
					var time_tag = ch_util.GetCurrentTimeTag();
					cmd = "INSERT INTO users (user_type ,user_id ,real_name ,gender ,password ,group_name ,last_user_modified_time) VALUES ('admin', '" + 
					admin_id + "', '" + req.body.real_name + "' ,'" + req.body.gender + "' ,'"+ password + "','" + group_name + "' ,'" + time_tag + "')";
					new_admin_id = conn.query(cmd);
					var err_result = null;
					new_admin_id.on('error' ,function(err){
						err_result = err;
					}
					);
					new_admin_id.on('end' ,function(){
						if(!err_result)
						{
							
							cmd = "INSERT INTO " + group_name + "_group_members (member_id ,access_status) VALUES ('"+ admin_id + "' ," + CH_GA_ACCEPT + ")";
							var insert_member = conn.query(cmd);
							insert_member.on('end' ,function(){
								if(req.session.client_device == 'browser')
								{
									req.session.reg_admin_errcode = CH_ERROR_SUCCESS;
									res.redirect('/admin_page/register_admin');
								}
								else
									res.json({errcode : CH_ERROR_SUCCESS ,msg : "Register admin success"});
							});
						}
						else
						{
							if(req.session.client_device == 'browser')
							{
								req.session.reg_admin_errcode = CH_ERROR_INTERNAL_PROBLEM;
								res.redirect('/admin_page/register_admin');
							}
							else
								res.json({errcode : CH_ERROR_INTERNAL_PROBLEM ,msg : "Promblem occur in server"});
						}
					});
				}
			}
		});
		//res.redirect('/admin_page/register_admin');
	}
	else
		res.json({errcode : CH_ERROR_PRIVILEGE ,msg : "You don't have this privilege!"});
}
);

module.exports = router;