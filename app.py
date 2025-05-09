from flask import Flask, render_template, request, redirect, abort, url_for

app = Flask(__name__)

@app.route("/")
def hello_world():
    return render_template('index.html')

@app.route("/simulation", methods = ['GET','POST'])
def visual():
    if (request.method == 'POST'):

        return redirect(url_for('controller_db'))
    else:
        return "<p>RETURN SIMULATION PAGE</p>"

@app.route("/stadistics")
def stats():
    return "<p>RETURN STADISTICS PAGE</p>"

"""
@app.errorhandler(404)
def page_not_found(error):
    return render_template(), 404
"""

